import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { selectFile, uploadDocument, getDocuments, deleteDocument, getKnowledgePoints, Document } from '../services/api';
import './DataCenter.css';

const DataCenter: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    loadDocuments();
    loadKnowledgePoints();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadKnowledgePoints = async () => {
    try {
      const points = await getKnowledgePoints();
      setKnowledgePoints(points);
    } catch (error) {
      console.error('Failed to load knowledge points:', error);
    }
  };

  const handleFileSelect = async () => {
    const filePath = await selectFile();
    if (!filePath) return;

    setIsUploading(true);
    setUploadProgress(t('dataCenter.processing'));
    
    try {
      await uploadDocument(filePath);
      setUploadProgress(t('dataCenter.documentProcessed'));
      await loadDocuments();
      await loadKnowledgePoints();

      setTimeout(() => {
        setUploadProgress('');
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(`Error: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm(t('dataCenter.confirmDelete'))) {
      return;
    }

    setDeletingId(documentId);
    try {
      await deleteDocument(documentId);
      await loadDocuments();
      await loadKnowledgePoints();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`${t('dataCenter.deleteFailed')}: ${error}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="data-center">
      <h2>{t('dataCenter.title')}</h2>
      
      <div className="upload-section">
        <button onClick={handleFileSelect} disabled={isUploading}>
          {isUploading ? t('dataCenter.processing') : t('dataCenter.selectAndUpload')}
        </button>
        {uploadProgress && <p>{uploadProgress}</p>}
      </div>

      <div className="documents-list">
        <h3>{t('dataCenter.documents')}</h3>
        {documents.length === 0 ? (
          <p>{t('dataCenter.noDocuments')}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t('dataCenter.filename')}</th>
                <th>{t('dataCenter.fileType')}</th>
                <th>{t('dataCenter.uploadTime')}</th>
                <th>{t('dataCenter.status')}</th>
                <th>{t('dataCenter.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.filename}</td>
                  <td>{doc.fileType}</td>
                  <td>{doc.uploadTime}</td>
                  <td>{doc.processed ? t('dashboard.processed') : t('dashboard.pending')}</td>
                  <td>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="delete-btn"
                    >
                      {deletingId === doc.id ? t('dataCenter.deleting') : t('dataCenter.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="knowledge-points-list">
        <div className="knowledge-points-header">
          <h3>{t('dataCenter.knowledgePointsList')} ({knowledgePoints.length})</h3>
          <button type="button" className="refresh-kp-btn" onClick={loadKnowledgePoints}>
            {t('dataCenter.refreshKnowledgePoints')}
          </button>
        </div>
        {knowledgePoints.length === 0 ? (
          <p>{t('dataCenter.noKnowledgePoints')}</p>
        ) : (
          <ul className="knowledge-points-items">
            {knowledgePoints.map((content, index) => (
              <li key={index} className="knowledge-point-item">
                <span className="kp-index">{index + 1}.</span>
                <span className="kp-content">{content}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default DataCenter;
