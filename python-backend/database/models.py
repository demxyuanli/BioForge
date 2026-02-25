"""
Database Models
SQLAlchemy models for SQLite database
"""
import json
import os
from typing import TYPE_CHECKING
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()


class MountPoint(Base):
    """OS filesystem directory mounted into the app for reorganizing documents. Path is unique; name defaults to directory name."""
    __tablename__ = "mount_points"

    id = Column(Integer, primary_key=True)
    path = Column(String(1000), nullable=False, unique=True)  # OS absolute path, unique
    name = Column(String(255))  # display name, defaults to directory name
    description = Column(Text)  # annotation/description for this mount point
    created_at = Column(DateTime, default=datetime.utcnow)


class MountPointFileMeta(Base):
    """Per-file weight and note for files under a mount point. Key: (mount_point_id, relative_path)."""
    __tablename__ = "mount_point_file_meta"
    __table_args__ = (UniqueConstraint("mount_point_id", "relative_path", name="uq_mount_point_file_meta"),)

    id = Column(Integer, primary_key=True)
    mount_point_id = Column(Integer, ForeignKey("mount_points.id", ondelete="CASCADE"), nullable=False)
    relative_path = Column(String(1000), nullable=False)  # path relative to mount root
    weight = Column(Float, default=1.0)  # 0-5
    note = Column(Text)  # optional user note
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Directory(Base):
    __tablename__ = "directories"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    parent_id = Column(Integer, ForeignKey("directories.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    parent = relationship("Directory", remote_side=[id], backref="children")
    documents = relationship("Document", back_populates="directory")


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_type = Column(String(50))
    directory_id = Column(Integer, ForeignKey("directories.id", ondelete="SET NULL"), nullable=True)
    upload_time = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)
    # processing_status: 'pending', 'processing', 'completed', 'failed'
    processing_status = Column(String(50), default='pending') 
    processing_message = Column(Text) # Error message or progress details
    text_content = Column(Text)
    
    directory = relationship("Directory", back_populates="documents")
    knowledge_points = relationship("KnowledgePoint", back_populates="document")
    annotations = relationship("Annotation", back_populates="document")


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer)
    weight = Column(Float, default=1.0)
    excluded = Column(Boolean, default=False)  # excluded from training (display-only deletion status)
    is_manual = Column(Boolean, default=False)  # True = user-created, False = auto-extracted from document
    tags = Column(Text)  # JSON string of tags
    keywords = Column(Text)  # JSON string of keywords (user-selected text fragments)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    document = relationship("Document", back_populates="knowledge_points")
    annotations = relationship("Annotation", back_populates="knowledge_point")


class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    knowledge_point_id = Column(Integer, ForeignKey("knowledge_points.id", ondelete="CASCADE"))
    instruction = Column(Text)
    response = Column(Text)
    question = Column(Text)
    answer = Column(Text)
    score = Column(Integer)  # 1-5 score
    preference_rank = Column(Integer)
    is_negative = Column(Boolean, default=False)
    format_type = Column(String(50))  # 'sft', 'dpo', 'qa'
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    document = relationship("Document", back_populates="annotations")
    knowledge_point = relationship("KnowledgePoint", back_populates="annotations")


class Skill(Base):
    """Skill: executable capability - answers 'how to do'. Has optional link to Rules (constraints)."""
    __tablename__ = "skills"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)  # What this skill does (function description)
    type = Column(String(64), nullable=False, default="custom")  # api_call, knowledge_retrieval, custom
    config = Column(Text)  # JSON: e.g. {"api_url": "...", "knowledge_base_id": 1}
    rule = Column(Text)  # Legacy inline rule text (optional); prefer linked rules via skill_rules
    trigger_conditions = Column(Text)  # When to use this skill
    steps = Column(Text)  # Execution steps (brief)
    output_description = Column(Text)  # Expected output
    example = Column(Text)  # Optional usage example
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Rule(Base):
    """Rule: constraint or policy - answers 'what is allowed / not allowed'. Reusable across skills."""
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    category = Column(String(128))  # e.g. naming, architecture, security
    content = Column(Text)  # Must/must not, naming, architecture constraints, verification
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SkillRule(Base):
    """Many-to-many: which rules apply when using a skill."""
    __tablename__ = "skill_rules"
    __table_args__ = (UniqueConstraint("skill_id", "rule_id", name="uq_skill_rule"),)

    id = Column(Integer, primary_key=True)
    skill_id = Column(Integer, ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    rule_id = Column(Integer, ForeignKey("rules.id", ondelete="CASCADE"), nullable=False)


class FinetuningJob(Base):
    __tablename__ = "finetuning_jobs"
    
    id = Column(Integer, primary_key=True)
    job_id = Column(String(255), unique=True)
    platform = Column(String(50))  # 'dashscope', 'fireworks', 'together'
    model = Column(String(100))
    status = Column(String(50))  # 'submitted', 'running', 'completed', 'failed'
    progress = Column(Float, default=0.0)
    cost_usd = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    endpoint_url = Column(String(500))
    log_path = Column(String(500))


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True)
    platform = Column(String(50), unique=True)
    encrypted_key = Column(Text, nullable=False)  # Encrypted API key
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingItem(Base):
    __tablename__ = "training_items"

    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    knowledge_point_keys = Column(Text, nullable=False)  # JSON string list
    prompt_template = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingAnnotation(Base):
    __tablename__ = "training_annotations"

    id = Column(Integer, primary_key=True)
    training_item_id = Column(Integer, ForeignKey("training_items.id", ondelete="CASCADE"), nullable=True)
    instruction = Column(Text, nullable=False)
    response = Column(Text, nullable=False)
    score = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TrainingAnnotationFinetuningLink(Base):
    __tablename__ = "training_annotation_finetuning_links"
    __table_args__ = (
        UniqueConstraint("training_annotation_id", "finetuning_job_id", name="uq_training_annotation_finetuning_job"),
    )

    id = Column(Integer, primary_key=True)
    training_annotation_id = Column(Integer, ForeignKey("training_annotations.id", ondelete="CASCADE"), nullable=False)
    finetuning_job_id = Column(String(255), ForeignKey("finetuning_jobs.job_id", ondelete="CASCADE"), nullable=False)
    used_at = Column(DateTime, default=datetime.utcnow)


def init_database(db_path: str = "aiforger.db"):
    """Initialize database and create tables"""
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    norm_path = db_path.replace("\\", "/")
    engine = create_engine(
        f"sqlite:///{norm_path}",
        connect_args={"check_same_thread": False},
        pool_size=20,
        max_overflow=30,
        pool_pre_ping=True,
    )
    try:
        Base.metadata.create_all(engine, checkfirst=True)
    except OperationalError as e:
        if "already exists" not in str(e).lower():
            raise
    # Add missing columns to knowledge_points if missing (migration)
    from sqlalchemy import text, inspect
    insp = inspect(engine)
    if "knowledge_points" in insp.get_table_names():
        cols = [c["name"] for c in insp.get_columns("knowledge_points")]
        if "weight" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN weight REAL DEFAULT 1.0"))
                conn.commit()
        if "excluded" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN excluded INTEGER DEFAULT 0"))
                conn.commit()
        if "is_manual" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN is_manual INTEGER DEFAULT 0"))
                conn.commit()
        if "tags" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN tags TEXT"))
                conn.commit()
        if "keywords" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE knowledge_points ADD COLUMN keywords TEXT"))
                conn.commit()
    # Full-text search (FTS5) virtual table for parsed content
    try:
        with engine.connect() as conn:
            conn.execute(text(
                "CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5("
                "content, document_id UNINDEXED, knowledge_point_id UNINDEXED)"
            ))
            conn.commit()
    except Exception:
        pass
    # Add missing columns to skills if missing (migration)
    if "skills" in insp.get_table_names():
        skill_cols = [c["name"] for c in insp.get_columns("skills")]
        if "rule" not in skill_cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE skills ADD COLUMN rule TEXT"))
                conn.commit()
        for col in ("trigger_conditions", "steps", "output_description", "example"):
            if col not in skill_cols:
                with engine.connect() as conn:
                    conn.execute(text(f"ALTER TABLE skills ADD COLUMN {col} TEXT"))
                    conn.commit()
                skill_cols.append(col)
    # Ensure rules and skill_rules tables exist (create_all already ran; they are new models)
    try:
        Base.metadata.create_all(engine, checkfirst=True)
    except OperationalError:
        pass
    # Seed default skills when table exists and is empty
    _seed_default_skills(engine)
    return engine


if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def _seed_default_skills(engine):
    """Insert default skills based on system features when the skills table is empty."""
    from sqlalchemy import inspect
    from sqlalchemy.orm import sessionmaker
    insp = inspect(engine)
    if "skills" not in insp.get_table_names():
        return
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    db = session_factory()
    try:
        if db.query(Skill).count() > 0:
            return
        for d in _default_skill_definitions():
            s = Skill(
                name=d["name"],
                description=d["description"],
                type=d["type"],
                config=json.dumps(d["config"]) if d.get("config") is not None else None,
                enabled=d.get("enabled", True),
            )
            db.add(s)
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _default_skill_definitions():
    """Return the list of default skill definitions (dicts with name, description, type, config, enabled)."""
    return [
        {
            "name": "Knowledge retrieval",
            "description": "Retrieve relevant knowledge from the knowledge base for chat or evaluation.",
            "type": "knowledge_retrieval",
            "config": {},
            "enabled": True,
        },
        {
            "name": "API call",
            "description": "Call external APIs or services (e.g. search, tools).",
            "type": "api_call",
            "config": {},
            "enabled": True,
        },
        {
            "name": "Document summary",
            "description": "Generate or use document summaries for file resources.",
            "type": "custom",
            "config": {},
            "enabled": True,
        },
        {
            "name": "Training data export",
            "description": "Export annotations or JSONL for fine-tuning in Training Lab.",
            "type": "custom",
            "config": {},
            "enabled": True,
        },
        {
            "name": "Evaluation compare",
            "description": "Compare model output before and after fine-tuning in Evaluation.",
            "type": "custom",
            "config": {},
            "enabled": True,
        },
    ]


def ensure_default_skills(db: "Session") -> None:
    """If the skills table is empty, insert default skills. Safe to call on every list."""
    if db.query(Skill).count() > 0:
        return
    for d in _default_skill_definitions():
        s = Skill(
            name=d["name"],
            description=d["description"],
            type=d["type"],
            config=json.dumps(d["config"]) if d.get("config") is not None else None,
            enabled=d.get("enabled", True),
        )
        db.add(s)
    try:
        db.commit()
    except Exception:
        db.rollback()
