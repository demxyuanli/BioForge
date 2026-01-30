import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getFinetuningJobs, getDocuments, FinetuningJob, Document } from '../services/api';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState<FinetuningJob[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalCost: 0
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [jobsData, docsData] = await Promise.all([
        getFinetuningJobs(),
        getDocuments()
      ]);
      
      setJobs(jobsData);
      setDocuments(docsData);
      
      const activeJobs = jobsData.filter(j => j.status === 'running' || j.status === 'submitted');
      const completedJobs = jobsData.filter(j => j.status === 'completed');
      const totalCost = jobsData.reduce((sum, job) => sum + (job.costUsd || 0), 0);
      
      setStats({
        totalDocuments: docsData.length,
        totalJobs: jobsData.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        totalCost
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  return (
    <div className="dashboard">
      <h2>{t('dashboard.title')}</h2>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalDocuments')}</div>
          <div className="stat-value">{stats.totalDocuments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalJobs')}</div>
          <div className="stat-value">{stats.totalJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.activeJobs')}</div>
          <div className="stat-value">{stats.activeJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.completedJobs')}</div>
          <div className="stat-value">{stats.completedJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalCost')}</div>
          <div className="stat-value">${stats.totalCost.toFixed(2)}</div>
        </div>
      </div>

      <div className="dashboard-sections">
        <div className="recent-jobs">
          <h3>{t('dashboard.recentJobs')}</h3>
          {jobs.length === 0 ? (
            <p>{t('dashboard.noJobs')}</p>
          ) : (
            <div className="jobs-list">
              {jobs.slice(0, 5).map((job) => (
                <div key={job.id} className="job-card">
                  <div className="job-header">
                    <span className="job-id">{job.id}</span>
                    <span className={`job-status job-status-${job.status}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="job-details">
                    <div>{t('dashboard.platform')}: {job.platform}</div>
                    <div>{t('dashboard.model')}: {job.model}</div>
                    {job.status === 'running' && (
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    )}
                    {job.costUsd && <div>{t('dashboard.cost')}: ${job.costUsd.toFixed(2)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="recent-documents">
          <h3>{t('dashboard.recentDocuments')}</h3>
          {documents.length === 0 ? (
            <p>{t('dashboard.noDocuments')}</p>
          ) : (
            <div className="documents-list">
              {documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="document-card">
                  <div className="doc-name">{doc.filename}</div>
                  <div className="doc-meta">
                    <span className="doc-type">{doc.fileType}</span>
                    <span className={`doc-status ${doc.processed ? 'processed' : 'pending'}`}>
                      {doc.processed ? t('dashboard.processed') : t('dashboard.pending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
