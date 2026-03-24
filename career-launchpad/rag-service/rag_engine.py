"""
Handles ChromaDB vector storage and retrieval using sentence-transformers.
"""

import json
import os
import chromadb
from sentence_transformers import SentenceTransformer

# --- Configuration 
CHROMA_PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
COLLECTION_NAME = "job_postings"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"  # Fast, good quality, runs locally

# --- Singleton instances 
_embedder = None
_chroma_client = None
_collection = None


def get_embedder():
    """Lazy-load the sentence transformer model."""
    global _embedder
    if _embedder is None:
        print("📦 Loading embedding model (first time may download ~80MB)...")
        _embedder = SentenceTransformer(EMBEDDING_MODEL)
        print("✅ Embedding model loaded.")
    return _embedder


def get_collection():
    """Get or create the ChromaDB collection."""
    global _chroma_client, _collection
    if _collection is None:
        _chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        _collection = _chroma_client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"description": "Job postings for career intelligence"},
        )
    return _collection


def embed_text(text: str) -> list[float]:
    """Convert text to a vector embedding."""
    model = get_embedder()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Batch embed multiple texts."""
    model = get_embedder()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=True)
    return embeddings.tolist()


# --- Indexing 

def build_document_text(job: dict) -> str:
    """
    Combine job fields into a single searchable document.
    
    This is the text that gets embedded — it determines what
    queries will match this job posting. We include all relevant
    fields so the embedding captures the full context.
    """
    parts = [
        f"Job Title: {job['title']}",
        f"Company: {job['company']}",
        f"Location: {job['location']}",
        f"Salary: {job['salary_range']}",
        f"Experience: {job['experience_level']}",
        f"Category: {job['category']}",
        f"Description: {job['description']}",
        f"Requirements: {job['requirements']}",
        f"Nice to Have: {job['nice_to_have']}",
    ]
    return "\n".join(parts)


def seed_database(data_path: str = None) -> int:
    """
    Load job postings from JSON and index them in ChromaDB.
    
    Returns the number of documents indexed.
    """
    if data_path is None:
        data_path = os.path.join(os.path.dirname(__file__), "data", "job_postings.json")

    with open(data_path, "r") as f:
        jobs = json.load(f)

    collection = get_collection()

    # Check if already seeded
    existing = collection.count()
    if existing > 0:
        print(f"📊 Collection already has {existing} documents. Clearing and re-seeding...")
        # Delete existing documents
        existing_ids = collection.get()["ids"]
        if existing_ids:
            collection.delete(ids=existing_ids)

    # Build documents and metadata
    documents = []
    metadatas = []
    ids = []

    for job in jobs:
        doc_text = build_document_text(job)
        documents.append(doc_text)
        metadatas.append({
            "title": job["title"],
            "company": job["company"],
            "location": job["location"],
            "salary_range": job["salary_range"],
            "experience_level": job["experience_level"],
            "category": job["category"],
            "posted_date": job["posted_date"],
        })
        ids.append(job["id"])

    # Embed all documents at once (batch is faster)
    print(f"🔢 Embedding {len(documents)} job postings...")
    embeddings = embed_texts(documents)

    # Add to ChromaDB
    collection.add(
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )

    count = collection.count()
    print(f"✅ Indexed {count} job postings into ChromaDB.")
    return count


# --- Retrieval 

def retrieve(query: str, top_k: int = 5, category_filter: str = None) -> list[dict]:
    """
    Search the vector database for job postings relevant to the query.
    
    Args:
        query: The user's natural language question
        top_k: Number of results to return
        category_filter: Optional category to filter by
        
    Returns:
        List of dicts with 'document', 'metadata', 'distance' keys
    """
    collection = get_collection()

    if collection.count() == 0:
        return []

    # Embed the query
    query_embedding = embed_text(query)

    # Build optional filter
    where_filter = None
    if category_filter:
        where_filter = {"category": category_filter}

    # Query ChromaDB
    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(top_k, collection.count()),
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    # Format results
    formatted = []
    for i in range(len(results["ids"][0])):
        formatted.append({
            "id": results["ids"][0][i],
            "document": results["documents"][0][i],
            "metadata": results["metadatas"][0][i],
            "distance": results["distances"][0][i],
        })

    return formatted


def get_stats() -> dict:
    """Get database statistics."""
    collection = get_collection()
    count = collection.count()

    # Get unique categories
    if count > 0:
        all_meta = collection.get(include=["metadatas"])
        categories = list(set(m["category"] for m in all_meta["metadatas"]))
    else:
        categories = []

    return {
        "total_documents": count,
        "categories": sorted(categories),
        "collection_name": COLLECTION_NAME,
        "embedding_model": EMBEDDING_MODEL,
    }
