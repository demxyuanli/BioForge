import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ListChecks, X } from 'lucide-react';
import { getSkills, type Skill } from '../services/api';
import './SkillSelector.css';

interface SkillSelectorProps {
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  maxHeight?: string;
}

const SkillSelector: React.FC<SkillSelectorProps> = ({ selectedIds, onChange, maxHeight }) => {
  const { t } = useTranslation();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getSkills().then((data) => {
      if (!cancelled) {
        setSkills(data.filter((s) => s.enabled));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const toggle = (id: number) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  const removeTag = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onChange(selectedIds.filter((x) => x !== id));
  };

  const selectedSkills = skills.filter((s) => selectedIds.includes(s.id));

  if (loading || skills.length === 0) return null;

  return (
    <div className="skill-selector skill-selector-inline" ref={containerRef}>
      <div className="skill-selector-row">
        <button
          type="button"
          className="skill-selector-icon-btn"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={t('skills.useInSession')}
          title={t('skills.useInSession')}
        >
          <ListChecks size={16} aria-hidden />
        </button>
        <div className="skill-selector-tags">
          {selectedSkills.map((s) => (
            <span key={s.id} className="skill-selector-tag">
              <span className="skill-selector-tag-label">{s.name}</span>
              <button
                type="button"
                className="skill-selector-tag-remove"
                onClick={(e) => removeTag(e, s.id)}
                aria-label={`${t('common.remove')} ${s.name}`}
              >
                <X size={12} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      </div>
      {open && (
        <div
          className="skill-selector-dropdown-panel"
          role="listbox"
          aria-multiselectable="true"
          style={maxHeight ? { maxHeight } : undefined}
        >
          <div className="skill-selector-title">{t('skills.useInSession')}</div>
          <div className="skill-selector-list">
            {skills.map((s) => (
              <label key={s.id} className="skill-selector-item">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  aria-label={s.name}
                />
                <span className="skill-selector-item-name">{s.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillSelector;
