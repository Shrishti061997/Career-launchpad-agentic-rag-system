"""
Seeds the ChromaDB database with job postings from job_postings.json.
Run once before starting the server: python seed_data.py
"""

import time
from rag_engine import seed_database, get_stats


def main():
    print("=" * 50)
    print("🌱 Career Launchpad - Database Seeder")
    print("=" * 50)
    print()

    start = time.time()
    count = seed_database()
    elapsed = time.time() - start

    print()
    print(f"⏱️  Completed in {elapsed:.1f} seconds")
    print()

    # Print stats
    stats = get_stats()
    print("📊 Database Stats:")
    print(f"   Total documents: {stats['total_documents']}")
    print(f"   Categories: {', '.join(stats['categories'])}")
    print(f"   Embedding model: {stats['embedding_model']}")
    print()
    print("✅ Ready! You can now start the RAG service with:")
    print("   uvicorn main:app --reload --port 8000")
    print()


if __name__ == "__main__":
    main()
