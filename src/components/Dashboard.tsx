import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FinetuningJob, Document } from '../services/api';
import './Dashboard.css';

interface DashboardProps {
  backendStarted?: boolean;
  documentsCount?: number;
  processedCount?: number;
  jobsCount?: number;
  activeJobsCount?: number;
  documents?: Document[];
  jobs?: FinetuningJob[];
}

const Dashboard: React.FC<DashboardProps> = ({
  backendStarted = true,
  documentsCount,
  processedCount,
  jobsCount,
  activeJobsCount,
  documents = [],
  jobs = []
}) => {
  const { t } = useTranslation();

  const displayStats = useMemo(() => {
    const completedJobs = jobs.filter(j => j.status === 'completed');
    const totalCost = jobs.reduce((sum, job) => sum + (job.costUsd || 0), 0);
    return {
      totalDocuments: documentsCount ?? documents.length,
      totalJobs: jobsCount ?? jobs.length,
      activeJobs: activeJobsCount ?? jobs.filter(j => j.status === 'running' || j.status === 'submitted').length,
      completedJobs: completedJobs.length,
      totalCost
    };
  }, [documents, jobs, documentsCount, jobsCount, activeJobsCount]);

  return (
    <div className="dashboard">
      <div className="dashboard-status-bar">
        <span className="dashboard-status-item">
          {t('panel.status')}: {backendStarted ? t('status.ready') : t('status.loading')}
        </span>
        {processedCount != null && (
          <span className="dashboard-status-item">
            {t('panel.processedDocuments')}: {processedCount}
          </span>
        )}
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalDocuments')}</div>
          <div className="stat-value">{displayStats.totalDocuments}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalJobs')}</div>
          <div className="stat-value">{displayStats.totalJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.activeJobs')}</div>
          <div className="stat-value">{displayStats.activeJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.completedJobs')}</div>
          <div className="stat-value">{displayStats.completedJobs}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('dashboard.totalCost')}</div>
          <div className="stat-value">${displayStats.totalCost.toFixed(2)}</div>
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
