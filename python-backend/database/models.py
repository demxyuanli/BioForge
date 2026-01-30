"""
Database Models
SQLAlchemy models for SQLite database
"""
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

Base = declarative_base()


class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_type = Column(String(50))
    upload_time = Column(DateTime, default=datetime.utcnow)
    processed = Column(Boolean, default=False)
    text_content = Column(Text)
    
    knowledge_points = relationship("KnowledgePoint", back_populates="document")
    annotations = relationship("Annotation", back_populates="document")


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"))
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer)
    tags = Column(Text)  # JSON string of tags
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


def init_database(db_path: str = "privatetune.db"):
    """Initialize database and create tables"""
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    return engine
