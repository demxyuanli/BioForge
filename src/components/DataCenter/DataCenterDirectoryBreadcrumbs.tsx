import React from 'react';
import { useTranslation } from 'react-i18next';

export interface BreadcrumbItem {
  id: number | null;
  name: string;
}

interface DataCenterDirectoryBreadcrumbsProps {
  breadcrumbs: BreadcrumbItem[];
  currentDirId: number | null;
  onSelectDir: (id: number | null) => void;
}

const DataCenterDirectoryBreadcrumbs: React.FC<DataCenterDirectoryBreadcrumbsProps> = ({
  breadcrumbs,
  currentDirId,
  onSelectDir,
}) => {
  const { t } = useTranslation();
  return (
    <div className="dc-upper-top">
      <span className="dc-upper-top-label">{t('knowledgeBaseWorkspace.directory')}</span>
      <span className="dc-upper-top-brackets">
        {breadcrumbs.map((crumb) => (
          <button
            key={crumb.id ?? 'root'}
            type="button"
            className={`dc-upper-top-tag ${currentDirId === crumb.id ? 'dc-upper-top-tag-selected' : ''}`}
            onClick={() => onSelectDir(crumb.id)}
            aria-pressed={currentDirId === crumb.id}
          >
            [ {crumb.name} ]
          </button>
        ))}
      </span>
    </div>
  );
};

export default React.memo(DataCenterDirectoryBreadcrumbs);
