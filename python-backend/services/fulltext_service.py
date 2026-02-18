"""
Full-text search service using SQLite FTS5.
Indexes parsed content (knowledge point text) for keyword search.
"""
from typing import List, Dict, Any
from sqlalchemy import text
from sqlalchemy.engine import Engine

FTS_TABLE = "fts_content"


def ensure_fts_table(engine: Engine) -> None:
    """Create FTS5 virtual table if it does not exist."""
    with engine.connect() as conn:
        conn.execute(text(
            f"CREATE VIRTUAL TABLE IF NOT EXISTS {FTS_TABLE} USING fts5("
            "content, document_id UNINDEXED, knowledge_point_id UNINDEXED)"
        ))
        conn.commit()


def add_to_fts(engine: Engine, document_id: int, knowledge_point_id: int, content: str) -> None:
    """Insert one knowledge point content into the full-text index."""
    if not content or not content.strip():
        return
    ensure_fts_table(engine)
    with engine.connect() as conn:
        conn.execute(
            text(f"INSERT INTO {FTS_TABLE} (document_id, knowledge_point_id, content) VALUES (:d, :k, :c)"),
            {"d": document_id, "k": knowledge_point_id, "c": content.strip()}
        )
        conn.commit()


def remove_document_from_fts(engine: Engine, document_id: int) -> None:
    """Remove all indexed rows for a document."""
    with engine.connect() as conn:
        conn.execute(text(f"DELETE FROM {FTS_TABLE} WHERE document_id = :d"), {"d": document_id})
        conn.commit()


def rebuild_fts_index(engine: Engine) -> int:
    """
    Rebuild full-text index from all knowledge_points in the database.
    Returns number of rows indexed.
    """
    ensure_fts_table(engine)
    from sqlalchemy import text as sql_text
    from sqlalchemy.orm import Session
    from database.models import KnowledgePoint
    with engine.connect() as conn:
        conn.execute(sql_text(f"DELETE FROM {FTS_TABLE}"))
        conn.commit()
    db = Session(engine)
    count = 0
    try:
        kps = db.query(KnowledgePoint).all()
        for kp in kps:
            if kp.content and str(kp.content).strip():
                add_to_fts(engine, kp.document_id, kp.id, kp.content)
                count += 1
    finally:
        db.close()
    return count


def search(engine: Engine, query: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Full-text search. Returns list of dicts with document_id, knowledge_point_id, snippet.
    query: FTS5 search expression (e.g. simple keyword or "phrase").
    """
    query = (query or "").strip()
    if not query:
        return []
    ensure_fts_table(engine)
    # FTS5: use simple token query; avoid phrase wrap so single/multi word both work
    safe_query = query.replace('"', '""').strip()
    if not safe_query:
        return []
    results = []
    for q in (safe_query, f'"{safe_query}"' if " " in safe_query and not safe_query.startswith('"') else None):
        if q is None:
            continue
        try:
            with engine.connect() as conn:
                rows = conn.execute(
                    text(
                        f"SELECT document_id, knowledge_point_id, snippet({FTS_TABLE}, 0, '<b>', '</b>', '...', 64) AS snippet "
                        f"FROM {FTS_TABLE} WHERE {FTS_TABLE} MATCH :q ORDER BY rank LIMIT :lim"
                    ),
                    {"q": q, "lim": limit}
                ).fetchall()
                for row in rows:
                    results.append({
                        "document_id": row[0],
                        "knowledge_point_id": row[1],
                        "snippet": row[2] or "",
                    })
                if results:
                    break
        except Exception as e:
            err = str(e).lower()
            if "syntax error" in err or "malformed" in err or "fts5" in err:
                continue
            raise
    return results
