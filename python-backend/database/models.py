"""
Database Models
SQLAlchemy models for SQLite database
"""
import os
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey, UniqueConstraint
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


def init_database(db_path: str = "privatetune.db"):
    """Initialize database and create tables"""
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    norm_path = db_path.replace("\\", "/")
    engine = create_engine(f"sqlite:///{norm_path}")
    Base.metadata.create_all(engine)
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
    return engine
