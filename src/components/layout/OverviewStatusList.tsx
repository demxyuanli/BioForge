import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getFinetuningJobs, getDocuments } from '../../services/api';
import './OverviewStatusList.css';

const OverviewStatusList: React.FC = () => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalDocuments: 0,
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalCost: 0,
    processedCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, docsData] = await Promise.all([
        getFinetuningJobs(),
        getDocuments()
      ]);
      const activeJobs = jobsData.filter((j) => j.status === 'running' || j.status === 'submitted');
      const completedJobs = jobsData.filter((j) => j.status === 'completed');
      const totalCost = jobsData.reduce((sum, job) => sum + (job.costUsd || 0), 0);
      const processedCount = docsData.filter((d) => d.processed).length;
      setStats({
        totalDocuments: docsData.length,
        totalJobs: jobsData.length,
        activeJobs: activeJobs.length,
        completedJobs: completedJobs.length,
        totalCost,
        processedCount
      });
    } catch {
      setStats({
        totalDocuments: 0,
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        totalCost: 0,
        processedCount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="osl-container">
        <div className="osl-header">{t('sidebar.overviewStatusList')}</div>
        <div className="osl-loading">{t('sidebar.loading')}</div>
      </div>
    );
  }

  return (
    <div className="osl-container">
      <div className="osl-header">{t('sidebar.overviewStatusList')}</div>
      <ul className="osl-list">
        <li className="osl-item">
          <span className="osl-label">{t('dashboard.totalDocuments')}</span>
          <span className="osl-value">{stats.totalDocuments}</span>
        </li>
        <li className="osl-item">
          <span className="osl-label">{t('panel.processedDocuments')}</span>
          <span className="osl-value">{stats.processedCount}</span>
        </li>
        <li className="osl-item">
          <span className="osl-label">{t('dashboard.totalJobs')}</span>
          <span className="osl-value">{stats.totalJobs}</span>
        </li>
        <li className="osl-item">
          <span className="osl-label">{t('dashboard.activeJobs')}</span>
          <span className="osl-value">{stats.activeJobs}</span>
        </li>
        <li className="osl-item">
          <span className="osl-label">{t('dashboard.completedJobs')}</span>
          <span className="osl-value">{stats.completedJobs}</span>
        </li>
        <li className="osl-item">
          <span className="osl-label">{t('dashboard.totalCost')}</span>
          <span className="osl-value">${stats.totalCost.toFixed(2)}</span>
        </li>
      </ul>
    </div>
  );
};

export default OverviewStatusList;
