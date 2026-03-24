"""
Fetches job postings from Adzuna API and indexes them into ChromaDB.
"""

import os
import json
import time
import hashlib
import requests
from dotenv import load_dotenv

from rag_engine import get_collection, embed_texts, get_stats

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs"


def search_adzuna(
    query: str,
    country: str = "us",
    page: int = 1,
    results_per_page: int = 20,
    salary_min: int = None,
    category: str = None,
) -> dict:
    """
    Search the Adzuna API for job postings.

    Args:
        query: Search keywords (e.g., "machine learning engineer")
        country: Country code (us, gb, ca, au, etc.)
        page: Page number (starts at 1)
        results_per_page: Number of results per page (max 50)
        salary_min: Minimum salary filter
        category: Adzuna job category tag (e.g., "it-jobs")

    Returns:
        Raw API response dict with 'results' list
    """
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        raise ValueError(
            "ADZUNA_APP_ID and ADZUNA_APP_KEY must be set in .env file. "
            "Get free keys at https://developer.adzuna.com"
        )

    url = f"{ADZUNA_BASE_URL}/{country}/search/{page}"
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "results_per_page": results_per_page,
        "what": query,
        "content-type": "application/json",
        "sort_by": "relevance",
    }

    if salary_min:
        params["salary_min"] = salary_min
    if category:
        params["category"] = category

    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()


def parse_adzuna_job(job: dict) -> dict:
    """
    Parse a raw Adzuna job result into our standard format
    for indexing into ChromaDB.
    """
    # Generate a stable unique ID from the Adzuna job ID
    job_id = f"adzuna_{job.get('id', hashlib.md5(job.get('title', '').encode()).hexdigest()[:12])}"

    # Extract location
    location_data = job.get("location", {})
    location_parts = location_data.get("area", [])
    location = location_data.get("display_name", ", ".join(location_parts[-2:]) if len(location_parts) >= 2 else "Remote")

    # Extract salary
    salary_min = job.get("salary_min")
    salary_max = job.get("salary_max")
    if salary_min and salary_max:
        salary_range = f"${int(salary_min):,} - ${int(salary_max):,}"
    elif salary_min:
        salary_range = f"${int(salary_min):,}+"
    elif job.get("salary_is_predicted") and salary_max:
        salary_range = f"~${int(salary_max):,} (estimated)"
    else:
        salary_range = "Not specified"

    # Extract company
    company = job.get("company", {}).get("display_name", "Unknown Company")

    # Extract category
    category = job.get("category", {}).get("label", "Technology")

    # Extract contract info
    contract_type = job.get("contract_type", "")
    contract_time = job.get("contract_time", "")
    employment_info = " ".join(filter(None, [contract_type, contract_time])).title() or "Full-time"

    # Build description (Adzuna provides a snippet)
    description = job.get("description", "No description available.")

    return {
        "id": job_id,
        "title": job.get("title", "Unknown Title"),
        "company": company,
        "location": location,
        "salary_range": salary_range,
        "experience_level": employment_info,
        "description": description,
        "category": category,
        "posted_date": job.get("created", "")[:10],
        "redirect_url": job.get("redirect_url", ""),
        "source": "adzuna_live",
    }


def build_document_text(job: dict) -> str:
    """Build the full text document for embedding."""
    parts = [
        f"Job Title: {job['title']}",
        f"Company: {job['company']}",
        f"Location: {job['location']}",
        f"Salary: {job['salary_range']}",
        f"Employment: {job['experience_level']}",
        f"Category: {job['category']}",
        f"Description: {job['description']}",
    ]
    return "\n".join(parts)


def fetch_and_index(
    query: str = "jobs",
    country: str = "us",
    num_pages: int = 2,
    results_per_page: int = 20,
    clear_existing_live: bool = True,
) -> dict:
    """
    Fetch live jobs from Adzuna and index them into ChromaDB.

    Args:
        query: Search keywords
        country: Country code
        num_pages: Number of pages to fetch (each has up to results_per_page jobs)
        results_per_page: Jobs per page (max 50)
        clear_existing_live: Remove previously fetched live jobs before adding new ones

    Returns:
        Dict with stats about what was fetched and indexed
    """
    collection = get_collection()

    # Optionally clear previous live-fetched jobs
    if clear_existing_live:
        try:
            existing = collection.get(where={"source": "adzuna_live"}, include=["metadatas"])
            if existing["ids"]:
                collection.delete(ids=existing["ids"])
                print(f"🗑️  Removed {len(existing['ids'])} previously fetched live jobs.")
        except Exception:
            pass  # Collection might not have 'source' field in old entries

    all_jobs = []
    for page in range(1, num_pages + 1):
        print(f"📡 Fetching page {page}/{num_pages} for '{query}'...")
        try:
            raw = search_adzuna(query, country, page, results_per_page)
            results = raw.get("results", [])
            if not results:
                print(f"   No more results on page {page}.")
                break

            for r in results:
                parsed = parse_adzuna_job(r)
                all_jobs.append(parsed)

            print(f"   Got {len(results)} jobs from page {page}.")
            time.sleep(0.5)  # Be nice to the API
        except requests.HTTPError as e:
            print(f"   ⚠️ API error on page {page}: {e}")
            break
        except Exception as e:
            print(f"   ⚠️ Error on page {page}: {e}")
            break

    if not all_jobs:
        return {"fetched": 0, "indexed": 0, "query": query}

    # De-duplicate by ID
    seen_ids = set()
    unique_jobs = []
    for job in all_jobs:
        if job["id"] not in seen_ids:
            seen_ids.add(job["id"])
            unique_jobs.append(job)

    print(f"\n🔢 Embedding {len(unique_jobs)} unique job postings...")

    # Build documents and embed
    documents = [build_document_text(j) for j in unique_jobs]
    embeddings = embed_texts(documents)

    # Prepare metadata (ChromaDB only accepts simple types)
    metadatas = []
    for job in unique_jobs:
        metadatas.append({
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "salary_range": job["salary_range"],
            "experience_level": job["experience_level"],
            "category": job["category"],
            "posted_date": job["posted_date"],
            "source": "adzuna_live",
            "redirect_url": job.get("redirect_url", ""),
        })

    ids = [j["id"] for j in unique_jobs]

    # Upsert into ChromaDB
    collection.upsert(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )

    stats = get_stats()
    print(f"✅ Indexed {len(unique_jobs)} live jobs. Total in DB: {stats['total_documents']}")

    return {
        "fetched": len(all_jobs),
        "indexed": len(unique_jobs),
        "total_in_db": stats["total_documents"],
        "query": query,
        "country": country,
    }


# --- CLI Usage 
if __name__ == "__main__":
    import sys

    query = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "artificial intelligence"

    print("=" * 50)
    print(f"🌐 Fetching live jobs: '{query}'")
    print("=" * 50)
    print()

    result = fetch_and_index(query=query, num_pages=3, results_per_page=20)

    print()
    print(f"📊 Summary:")
    print(f"   Fetched: {result['fetched']} jobs")
    print(f"   Indexed: {result['indexed']} unique jobs")
    print(f"   Total in DB: {result['total_in_db']}")
