import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Plus, Pencil, Trash2, Shield } from 'lucide-react';
import {
  getSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  type Skill,
  type Rule
} from '../services/api';
import './SkillsWorkspace.css';

const SKILL_TYPES = ['custom', 'api_call', 'knowledge_retrieval'] as const;
type TabId = 'skills' | 'rules';

const SkillsWorkspace: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>('skills');
  const [list, setList] = useState<Skill[]>([]);
  const [rulesList, setRulesList] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<string>('custom');
  const [formConfigJson, setFormConfigJson] = useState('{}');
  const [formRule, setFormRule] = useState('');
  const [formTriggerConditions, setFormTriggerConditions] = useState('');
  const [formSteps, setFormSteps] = useState('');
  const [formOutputDescription, setFormOutputDescription] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formRuleIds, setFormRuleIds] = useState<number[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [ruleFormOpen, setRuleFormOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [ruleFormName, setRuleFormName] = useState('');
  const [ruleFormCategory, setRuleFormCategory] = useState('');
  const [ruleFormContent, setRuleFormContent] = useState('');
  const [ruleFormEnabled, setRuleFormEnabled] = useState(true);
  const [ruleFormError, setRuleFormError] = useState('');
  const [ruleSaving, setRuleSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsData, rulesData] = await Promise.all([getSkills(), getRules()]);
      setList(skillsData);
      setRulesList(rulesData);
    } catch (e) {
      console.error('Load skills/rules error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormType('custom');
    setFormConfigJson('{}');
    setFormRule('');
    setFormTriggerConditions('');
    setFormSteps('');
    setFormOutputDescription('');
    setFormExample('');
    setFormRuleIds([]);
    setFormEnabled(true);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (s: Skill) => {
    setEditingId(s.id);
    setFormName(s.name);
    setFormDescription(s.description || '');
    setFormType(s.type || 'custom');
    setFormConfigJson(JSON.stringify(s.config || {}, null, 2));
    setFormRule(s.rule ?? '');
    setFormTriggerConditions(s.trigger_conditions ?? '');
    setFormSteps(s.steps ?? '');
    setFormOutputDescription(s.output_description ?? '');
    setFormExample(s.example ?? '');
    setFormRuleIds(s.rule_ids ?? []);
    setFormEnabled(s.enabled);
    setFormError('');
    setFormOpen(true);
  };

  const openRuleCreate = () => {
    setEditingRuleId(null);
    setRuleFormName('');
    setRuleFormCategory('');
    setRuleFormContent('');
    setRuleFormEnabled(true);
    setRuleFormError('');
    setRuleFormOpen(true);
  };

  const openRuleEdit = (r: Rule) => {
    setEditingRuleId(r.id);
    setRuleFormName(r.name);
    setRuleFormCategory(r.category ?? '');
    setRuleFormContent(r.content ?? '');
    setRuleFormEnabled(r.enabled);
    setRuleFormError('');
    setRuleFormOpen(true);
  };

  const closeRuleForm = () => {
    setRuleFormOpen(false);
    setRuleFormError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    setFormError('');
  };

  const parseConfig = (): Record<string, unknown> | null => {
    const trimmed = formConfigJson.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = formName.trim();
    if (!name) {
      setFormError(t('skills.errorNameRequired'));
      return;
    }
    const config = parseConfig();
    if (config === null) {
      setFormError(t('skills.errorConfigJson'));
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        name,
        description: formDescription.trim() || undefined,
        type: formType,
        config,
        rule: formRule.trim() || undefined,
        trigger_conditions: formTriggerConditions.trim() || undefined,
        steps: formSteps.trim() || undefined,
        output_description: formOutputDescription.trim() || undefined,
        example: formExample.trim() || undefined,
        rule_ids: formRuleIds,
        enabled: formEnabled
      };
      if (editingId !== null) {
        await updateSkill(editingId, payload);
      } else {
        await createSkill(payload);
      }
      closeForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRuleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = ruleFormName.trim();
    if (!name) {
      setRuleFormError(t('rules.errorNameRequired'));
      return;
    }
    setRuleSaving(true);
    setRuleFormError('');
    try {
      if (editingRuleId !== null) {
        await updateRule(editingRuleId, {
          name,
          category: ruleFormCategory.trim() || undefined,
          content: ruleFormContent.trim() || undefined,
          enabled: ruleFormEnabled
        });
      } else {
        await createRule({
          name,
          category: ruleFormCategory.trim() || undefined,
          content: ruleFormContent.trim() || undefined,
          enabled: ruleFormEnabled
        });
      }
      closeRuleForm();
      await load();
    } catch (err) {
      setRuleFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setRuleSaving(false);
    }
  };

  const handleRuleDelete = async (id: number) => {
    if (!window.confirm(t('rules.confirmDelete'))) return;
    try {
      await deleteRule(id);
      await load();
    } catch (err) {
      console.error('Delete rule error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`${t('rules.deleteFailed') ?? 'Delete failed'}: ${msg}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('skills.confirmDelete'))) return;
    try {
      await deleteSkill(id);
      await load();
    } catch (err) {
      console.error('Delete skill error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      window.alert(`${t('skills.deleteFailed') ?? 'Delete failed'}: ${msg}`);
    }
  };

  const toggleRuleId = (ruleId: number) => {
    setFormRuleIds((prev) =>
      prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
    );
  };

  return (
    <div className="skills-workspace">
      <div className="skills-workspace-tabs">
        <button
          type="button"
          className={`skills-workspace-tab ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          <Sparkles size={14} aria-hidden />
          {t('skills.title')}
        </button>
        <button
          type="button"
          className={`skills-workspace-tab ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <Shield size={14} aria-hidden />
          {t('rules.title')}
        </button>
      </div>
      <div className="skills-workspace-panel">
        {activeTab === 'skills' && (
          <>
            <div className="skills-workspace-header">
              <div className="skills-workspace-header-left">
                <span className="skills-workspace-title">{t('skills.title')}</span>
              </div>
              <button
                type="button"
                className="skills-workspace-add-btn"
                onClick={openCreate}
                aria-label={t('skills.add')}
                title={t('skills.add')}
              >
                <Plus size={14} aria-hidden />
                <span>{t('skills.add')}</span>
              </button>
            </div>
            <div className="skills-workspace-concepts">
              <span className="skills-workspace-concepts-title">{t('skills.conceptsTitle')}:</span>
              <span className="skills-workspace-concepts-line">{t('skills.conceptsSkill')}</span>
              <span className="skills-workspace-concepts-line">{t('skills.conceptsRule')}</span>
              <span className="skills-workspace-concepts-line">{t('skills.conceptsKB')}</span>
            </div>
            <div className="skills-workspace-content">
              {loading ? (
                <p className="skills-workspace-muted">{t('status.loading')}</p>
              ) : list.length === 0 ? (
                <p className="skills-workspace-muted">{t('skills.empty')}</p>
              ) : (
                <ul className="skills-list">
                  {list.map((s) => (
                    <li key={s.id} className="skills-list-item">
                      <div className="skills-list-item-main">
                        <div className="skills-list-item-head">
                          <span className="skills-list-item-name">{s.name}</span>
                          <span className="skills-list-item-type">{t(`skills.types.${s.type}`)}</span>
                          {!s.enabled && <span className="skills-list-item-disabled">{t('skills.disabled')}</span>}
                        </div>
                        {s.description ? (
                          <p className="skills-list-item-desc">{s.description}</p>
                        ) : null}
                        {s.trigger_conditions ? (
                          <div className="skills-list-item-meta">
                            <span className="skills-list-item-config-label">{t('skills.triggerConditions')}</span>
                            <pre className="skills-list-item-rule">{s.trigger_conditions}</pre>
                          </div>
                        ) : null}
                        {s.steps ? (
                          <div className="skills-list-item-meta">
                            <span className="skills-list-item-config-label">{t('skills.steps')}</span>
                            <pre className="skills-list-item-rule">{s.steps}</pre>
                          </div>
                        ) : null}
                        {s.output_description ? (
                          <div className="skills-list-item-meta">
                            <span className="skills-list-item-config-label">{t('skills.outputDescription')}</span>
                            <pre className="skills-list-item-rule">{s.output_description}</pre>
                          </div>
                        ) : null}
                        {s.example ? (
                          <div className="skills-list-item-meta">
                            <span className="skills-list-item-config-label">{t('skills.example')}</span>
                            <pre className="skills-list-item-rule">{s.example}</pre>
                          </div>
                        ) : null}
                        {s.config && typeof s.config === 'object' && Object.keys(s.config).length > 0 ? (
                          <div className="skills-list-item-config-wrap">
                            <span className="skills-list-item-config-label">{t('skills.config')}</span>
                            <pre className="skills-list-item-config">{JSON.stringify(s.config, null, 2)}</pre>
                          </div>
                        ) : null}
                        {s.rule ? (
                          <div className="skills-list-item-rule-wrap">
                            <span className="skills-list-item-config-label">{t('skills.rule')} (inline)</span>
                            <pre className="skills-list-item-rule">{s.rule}</pre>
                          </div>
                        ) : null}
                        {s.rule_ids && s.rule_ids.length > 0 ? (
                          <div className="skills-list-item-rule-wrap">
                            <span className="skills-list-item-config-label">{t('skills.linkedRules')}</span>
                            <span className="skills-list-item-rule-names">
                              {s.rule_ids
                                .map((rid) => rulesList.find((r) => r.id === rid)?.name ?? `#${rid}`)
                                .join(', ')}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <div className="skills-list-item-actions">
                        <button
                          type="button"
                          className="skills-list-item-btn"
                          onClick={() => openEdit(s)}
                          aria-label={t('common.edit')}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="skills-list-item-btn skills-list-item-btn-danger"
                          onClick={() => handleDelete(s.id)}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
        {activeTab === 'rules' && (
          <>
            <div className="skills-workspace-header">
              <div className="skills-workspace-header-left">
                <span className="skills-workspace-title">{t('rules.title')}</span>
              </div>
              <button
                type="button"
                className="skills-workspace-add-btn"
                onClick={openRuleCreate}
                aria-label={t('rules.add')}
                title={t('rules.add')}
              >
                <Plus size={14} aria-hidden />
                <span>{t('rules.add')}</span>
              </button>
            </div>
            <div className="skills-workspace-content">
              {loading ? (
                <p className="skills-workspace-muted">{t('status.loading')}</p>
              ) : rulesList.length === 0 ? (
                <p className="skills-workspace-muted">{t('rules.empty')}</p>
              ) : (
                <ul className="skills-list">
                  {rulesList.map((r) => (
                    <li key={r.id} className="skills-list-item">
                      <div className="skills-list-item-main">
                        <div className="skills-list-item-head">
                          <span className="skills-list-item-name">{r.name}</span>
                          {r.category ? (
                            <span className="skills-list-item-type">{r.category}</span>
                          ) : null}
                          {!r.enabled && <span className="skills-list-item-disabled">{t('skills.disabled')}</span>}
                        </div>
                        {r.content ? (
                          <pre className="skills-list-item-rule">{r.content}</pre>
                        ) : null}
                      </div>
                      <div className="skills-list-item-actions">
                        <button
                          type="button"
                          className="skills-list-item-btn"
                          onClick={() => openRuleEdit(r)}
                          aria-label={t('common.edit')}
                        >
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="skills-list-item-btn skills-list-item-btn-danger"
                          onClick={() => handleRuleDelete(r.id)}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <div className="skills-modal-overlay" onClick={closeForm} role="presentation">
          <div className="skills-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="skills-modal-title">
              {editingId !== null ? t('skills.edit') : t('skills.add')}
            </h3>
            <form onSubmit={handleSubmit} className="skills-form">
              {formError && <p className="skills-form-error">{formError}</p>}
              <label className="skills-form-label">
                {t('skills.name')} *
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="skills-form-input"
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.description')}
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={2}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.type')}
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="skills-form-input skills-form-select"
                  disabled={saving}
                >
                  {SKILL_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`skills.types.${type}`)}</option>
                  ))}
                </select>
              </label>
              <label className="skills-form-label">
                {t('skills.triggerConditions')}
                <textarea
                  value={formTriggerConditions}
                  onChange={(e) => setFormTriggerConditions(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={2}
                  placeholder={t('skills.triggerConditionsPlaceholder')}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.steps')}
                <textarea
                  value={formSteps}
                  onChange={(e) => setFormSteps(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={3}
                  placeholder={t('skills.stepsPlaceholder')}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.outputDescription')}
                <textarea
                  value={formOutputDescription}
                  onChange={(e) => setFormOutputDescription(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={2}
                  placeholder={t('skills.outputDescriptionPlaceholder')}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.example')}
                <textarea
                  value={formExample}
                  onChange={(e) => setFormExample(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={2}
                  placeholder={t('skills.examplePlaceholder')}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label">
                {t('skills.config')}
                <textarea
                  value={formConfigJson}
                  onChange={(e) => setFormConfigJson(e.target.value)}
                  className="skills-form-input skills-form-textarea skills-form-config"
                  rows={4}
                  placeholder='{"api_url": "...", "knowledge_base_id": 1}'
                  disabled={saving}
                />
              </label>
              <div className="skills-form-label">
                {t('skills.linkedRules')}
                <p className="skills-form-hint">{t('skills.linkedRulesPlaceholder')}</p>
                <div className="skills-form-rule-checks">
                  {rulesList.map((r) => (
                    <label key={r.id} className="skills-form-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formRuleIds.includes(r.id)}
                        onChange={() => toggleRuleId(r.id)}
                        disabled={saving}
                      />
                      {r.name}{r.category ? ` (${r.category})` : ''}
                    </label>
                  ))}
                  {rulesList.length === 0 && (
                    <span className="skills-workspace-muted">{t('rules.empty')}</span>
                  )}
                </div>
              </div>
              <label className="skills-form-label">
                {t('skills.rule')} (inline)
                <textarea
                  value={formRule}
                  onChange={(e) => setFormRule(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={3}
                  placeholder={t('skills.rulePlaceholder')}
                  disabled={saving}
                />
              </label>
              <label className="skills-form-label skills-form-checkbox-label">
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                  disabled={saving}
                />
                {t('skills.enabled')}
              </label>
              <div className="skills-form-actions">
                <button type="button" className="skills-form-btn skills-form-btn-secondary" onClick={closeForm} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="skills-form-btn skills-form-btn-primary" disabled={saving}>
                  {saving ? t('status.loading') : (editingId !== null ? t('common.save') : t('skills.create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {ruleFormOpen && (
        <div className="skills-modal-overlay" onClick={closeRuleForm} role="presentation">
          <div className="skills-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="skills-modal-title">
              {editingRuleId !== null ? t('rules.edit') : t('rules.add')}
            </h3>
            <form onSubmit={handleRuleSubmit} className="skills-form">
              {ruleFormError && <p className="skills-form-error">{ruleFormError}</p>}
              <label className="skills-form-label">
                {t('rules.name')} *
                <input
                  type="text"
                  value={ruleFormName}
                  onChange={(e) => setRuleFormName(e.target.value)}
                  className="skills-form-input"
                  disabled={ruleSaving}
                />
              </label>
              <label className="skills-form-label">
                {t('rules.category')}
                <input
                  type="text"
                  value={ruleFormCategory}
                  onChange={(e) => setRuleFormCategory(e.target.value)}
                  className="skills-form-input"
                  placeholder={t('rules.categoryPlaceholder')}
                  disabled={ruleSaving}
                />
              </label>
              <label className="skills-form-label">
                {t('rules.content')}
                <textarea
                  value={ruleFormContent}
                  onChange={(e) => setRuleFormContent(e.target.value)}
                  className="skills-form-input skills-form-textarea"
                  rows={5}
                  placeholder={t('rules.contentPlaceholder')}
                  disabled={ruleSaving}
                />
              </label>
              <label className="skills-form-label skills-form-checkbox-label">
                <input
                  type="checkbox"
                  checked={ruleFormEnabled}
                  onChange={(e) => setRuleFormEnabled(e.target.checked)}
                  disabled={ruleSaving}
                />
                {t('rules.enabled')}
              </label>
              <div className="skills-form-actions">
                <button type="button" className="skills-form-btn skills-form-btn-secondary" onClick={closeRuleForm} disabled={ruleSaving}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="skills-form-btn skills-form-btn-primary" disabled={ruleSaving}>
                  {ruleSaving ? t('status.loading') : (editingRuleId !== null ? t('common.save') : t('rules.create'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsWorkspace;
