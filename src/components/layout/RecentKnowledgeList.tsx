import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getDocuments, type Document } from '../../services/api';
import './RecentKnowledgeList.css';

const RecentKnowledgeList: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecent();
  }, []);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const docs = await getDocuments();
      const processed = docs.filter((d) => d.processed);
      const sorted = [...processed].sort((a, b) => {
        const ta = new Date(a.uploadTime || 0).getTime();
        const tb = new Date(b.uploadTime || 0).getTime();
        return tb - ta;
      });
      setDocuments(sorted.slice(0, 20));
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rkl-container">
        <div className="rkl-header">{t('sidebar.recentKnowledgeList')}</div>
        <div className="rkl-loading">{t('sidebar.loading')}</div>
      </div>
    );
  }

  return (
    <div className="rkl-container">
      <div className="rkl-header">{t('sidebar.recentKnowledgeList')}</div>
      <ul className="rkl-list">
        {documents.length === 0 ? (
          <li className="rkl-empty">{t('sidebar.noRecentKnowledge')}</li>
        ) : (
          documents.map((doc) => (
            <li key={doc.id} className="rkl-item">
              <span className="rkl-name" title={doc.filename}>
                {doc.filename}
              </span>
              <span className="rkl-meta">{doc.fileType}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default RecentKnowledgeList;
