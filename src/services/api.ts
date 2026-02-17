import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

export interface Document {
  id: number;
  filename: string;
  fileType: string;
  uploadTime: string;
  processed: boolean;
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  processingMessage?: string;
  textContent?: string;
  chunks?: string[];
  knowledgePointCount?: number;
}

export interface Annotation {
  id?: number;
  instruction: string;
  response: string;
  question?: string;
  answer?: string;
  score?: number;
  formatType?: string;
  training_item_id?: number | null;
  created_at?: string | null;
  finetuned?: boolean;
  finetuned_count?: number;
  linked_jobs?: Array<{
    job_id: string;
    used_at?: string | null;
    job_status?: string | null;
    job_platform?: string | null;
    job_model?: string | null;
    job_created_at?: string | null;
  }>;
}

export interface FinetuningJob {
  id: string;
  platform: string;
  model: string;
  status: string;
  progress: number;
  costUsd?: number;
  createdAt?: string;
}

export interface TrainingItem {
  id: number;
  name: string;
  knowledge_point_keys: string[];
  prompt_template: string;
  created_at?: string;
  updated_at?: string;
}

export interface DirectoryNode {
  id: number;
  name: string;
  type: 'directory' | 'file';
  fileType?: string;
  processed?: boolean;
  uploadTime?: string;
  children?: DirectoryNode[];
  parentId?: number | null;
  directoryId?: number | null;
  knowledgePointCount?: number;
}

export async function getDirectories(): Promise<DirectoryNode[]> {
  try {
    const response = await invoke<string>('get_directories');
    const data = await parsePythonResponse(response);
    return data?.tree ?? [];
  } catch (error) {
    console.error('Get directories error:', error);
    return [];
  }
}

export async function createDirectory(name: string, parentId?: number): Promise<{ id: number }> {
  const response = await invoke<string>('create_directory', { name, parentId: parentId ?? null });
  const data = await parsePythonResponse(response);
  return data;
}

export async function moveDocument(documentId: number, directoryId?: number): Promise<void> {
  const response = await invoke<string>('move_document', { documentId, directoryId: directoryId ?? null });
  await parsePythonResponse(response);
}

export async function moveDirectory(directoryId: number, parentId?: number): Promise<void> {
  const response = await invoke<string>('move_directory', { directoryId, parentId: parentId ?? null });
  await parsePythonResponse(response);
}

export async function deleteDirectory(directoryId: number): Promise<void> {
  const response = await invoke<string>('delete_directory', { directoryId });
  await parsePythonResponse(response);
}

export interface DirEntry {
  name: string;
  isDirectory: boolean;
}

export async function getFileIcon(filePath: string): Promise<string | null> {
  try {
    const result = await invoke<string | null>('get_file_icon', { filePath });
    return result;
  } catch (error) {
    console.error('Get file icon error:', error);
    return null;
  }
}

export async function listSystemDir(path: string): Promise<DirEntry[]> {
  try {
    const response = await invoke<string>('list_system_dir', { path });
    const entries = JSON.parse(response || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch (error) {
    console.error('List directory error:', error);
    return [];
  }
}

export async function parsePythonResponse(response: string): Promise<any> {
  try {
    const result = JSON.parse(response.trim());
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.error || 'Unknown error');
    }
  } catch (error) {
    throw new Error(`Failed to parse response: ${error}`);
  }
}

const PREVIEW_CACHE_MAX_SIZE = 20;
const previewCache = new Map<string, { blobUrl: string; version: string }>();

function evictPreviewCache(): void {
  if (previewCache.size <= PREVIEW_CACHE_MAX_SIZE) return;
  const keysToRemove = Array.from(previewCache.keys()).slice(0, previewCache.size - PREVIEW_CACHE_MAX_SIZE);
  for (const key of keysToRemove) {
    const entry = previewCache.get(key);
    if (entry) URL.revokeObjectURL(entry.blobUrl);
    previewCache.delete(key);
  }
}

function base64ToBlob(base64: string, mime: string = 'application/pdf'): Blob {
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

export interface StorageConfig {
  documentsDir?: string;
  dbPath?: string;
}

export async function getStorageConfig(): Promise<StorageConfig | null> {
  try {
    const result = await invoke<StorageConfig | null>('get_storage_config');
    return result;
  } catch (error) {
    console.error('Get storage config error:', error);
    return null;
  }
}

export async function saveStorageConfig(documentsDir: string, dbPath: string): Promise<void> {
  await invoke('save_storage_config', { documentsDir, dbPath });
}

export async function getDefaultStoragePaths(): Promise<{ documentsDir: string; dbPath: string }> {
  const result = await invoke<{ documentsDir: string; dbPath: string }>('get_default_storage_paths');
  return result;
}

export interface RagConfig {
  chunkSize?: number;
  contextWindow?: number;
  useHybrid?: boolean;
  embeddingModel?: string;
  embeddingBaseUrl?: string;
  embeddingPlatform?: string;
}

export async function getRagConfig(): Promise<RagConfig> {
  try {
    const response = await invoke<string>('get_rag_config');
    const data = await parsePythonResponse(response);
    return (data && typeof data === 'object') ? data as RagConfig : {};
  } catch (error) {
    console.error('Get RAG config error:', error);
    return {};
  }
}

export async function saveRagConfig(config: RagConfig): Promise<RagConfig> {
  const response = await invoke<string>('save_rag_config', { config });
  const data = await parsePythonResponse(response);
  return (data && typeof data === 'object') ? data as RagConfig : {};
}

export interface MountPoint {
  id: number;
  path: string;
  name: string;
  description: string;
  created_at?: string;
}

function normalizePath(p: string): string {
  return (p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export async function getMountPoints(): Promise<MountPoint[]> {
  try {
    const response = await invoke<string>('get_mount_points');
    const data = await parsePythonResponse(response);
    const arr = Array.isArray(data) ? data : [];
    const byPath = new Map<string, MountPoint>();
    for (const mp of arr) {
      if (!mp || typeof mp.path !== 'string') continue;
      const key = normalizePath(mp.path);
      if (!key) continue;
      if (!byPath.has(key)) {
        byPath.set(key, {
          id: mp.id,
          path: mp.path,
          name: mp.name ?? '',
          description: mp.description ?? '',
          created_at: mp.created_at
        });
      }
    }
    return Array.from(byPath.values());
  } catch (error) {
    console.error('Get mount points error:', error);
    return [];
  }
}

export async function createMountPoint(path: string, name?: string, description?: string): Promise<MountPoint> {
  const response = await invoke<string>('create_mount_point', {
    path: path.trim(),
    name: name?.trim() ?? '',
    description: description?.trim() ?? ''
  });
  const data = await parsePythonResponse(response);
  if (!data?.id) throw new Error(data?.error ?? 'Create mount point failed');
  return {
    id: data.id,
    path: data.path ?? path,
    name: data.name ?? '',
    description: data.description ?? '',
    created_at: data.created_at
  };
}

export async function updateMountPoint(
  id: number,
  updates: { path?: string; name?: string; description?: string }
): Promise<MountPoint> {
  const response = await invoke<string>('update_mount_point', {
    mpId: id,
    path: updates.path !== undefined ? updates.path : undefined,
    name: updates.name !== undefined ? updates.name : undefined,
    description: updates.description !== undefined ? updates.description : undefined
  });
  const data = await parsePythonResponse(response);
  if (!data?.id) throw new Error(data?.error ?? 'Update mount point failed');
  return {
    id: data.id,
    path: data.path ?? '',
    name: data.name ?? '',
    description: data.description ?? '',
    created_at: data.created_at
  };
}

export async function deleteMountPoint(id: number): Promise<void> {
  const response = await invoke<string>('delete_mount_point', { mpId: id });
  await parsePythonResponse(response);
}

export async function deleteAllMountPoints(): Promise<{ deleted: number }> {
  const response = await invoke<string>('delete_all_mount_points');
  const data = await parsePythonResponse(response);
  return { deleted: data?.deleted ?? 0 };
}

export interface MountPointDocumentStats {
  total: number;
  by_type: Record<string, number>;
}

export async function getMountPointDocumentStats(mpId: number): Promise<MountPointDocumentStats> {
  const response = await invoke<string>('get_mount_point_document_stats', { mpId });
  const data = await parsePythonResponse(response);
  return {
    total: typeof data?.total === 'number' ? data.total : 0,
    by_type: data?.by_type && typeof data.by_type === 'object' ? data.by_type : {}
  };
}

export interface MountPointFileMetaItem {
  weight: number;
  note: string;
}

export interface MountPointFiles {
  by_type: Record<string, string[]>;
  file_meta?: Record<string, MountPointFileMetaItem>;
}

export async function getMountPointFiles(mpId: number): Promise<MountPointFiles> {
  const response = await invoke<string>('get_mount_point_files', { mpId });
  const data = await parsePythonResponse(response);
  const byType = data?.by_type && typeof data.by_type === 'object' ? data.by_type : {};
  const fileMeta: Record<string, MountPointFileMetaItem> = {};
  if (data?.file_meta && typeof data.file_meta === 'object') {
    for (const [k, v] of Object.entries(data.file_meta)) {
      if (v && typeof v === 'object' && typeof (v as { weight?: number }).weight === 'number') {
        const item = v as { weight: number; note?: string };
        fileMeta[k] = { weight: item.weight, note: typeof item.note === 'string' ? item.note : '' };
      }
    }
  }
  return { by_type: byType, file_meta: fileMeta };
}

export async function updateMountPointFileMeta(
  mpId: number,
  relativePath: string,
  payload: { weight?: number; note?: string }
): Promise<{ relative_path: string; weight: number; note: string }> {
  const response = await invoke<string>('update_mount_point_file_meta', {
    mpId,
    relativePath,
    weight: payload.weight !== undefined ? payload.weight : undefined,
    note: payload.note !== undefined ? payload.note : undefined
  });
  const data = await parsePythonResponse(response);
  return {
    relative_path: data?.relative_path ?? relativePath,
    weight: typeof data?.weight === 'number' ? data.weight : 0,
    note: typeof data?.note === 'string' ? data.note : ''
  };
}

export interface RecentAnnotatedFileItem {
  mount_point_id: number;
  mount_point_name: string;
  relative_path: string;
  filename: string;
  note: string;
  updated_at: string | null;
}

export async function getRecentAnnotatedFiles(): Promise<RecentAnnotatedFileItem[]> {
  const response = await invoke<string>('get_recent_annotated_files', {});
  const data = await parsePythonResponse(response);
  const items = Array.isArray(data?.items) ? data.items : [];
  return items.map((x: Record<string, unknown>) => ({
    mount_point_id: Number(x.mount_point_id),
    mount_point_name: String(x.mount_point_name ?? ''),
    relative_path: String(x.relative_path ?? ''),
    filename: String(x.filename ?? ''),
    note: String(x.note ?? ''),
    updated_at: x.updated_at != null ? String(x.updated_at) : null
  }));
}

export async function getDocumentSummary(mpId: number, relativePath: string): Promise<{ summary: string }> {
  const response = await invoke<string>('get_document_summary', { mpId, relativePath });
  const data = await parsePythonResponse(response);
  return { summary: typeof data?.summary === 'string' ? data.summary : '' };
}

export async function getDocumentPreview(mpId: number, relativePath: string): Promise<string | null> {
  try {
    const response = await invoke<string>('get_document_preview', { mpId, relativePath });
    const result = JSON.parse(response.trim());
    if (!result.success || typeof result.data !== 'string') return null;
    const data = result.data as string;
    const version = typeof result.version === 'string' ? result.version : '';
    const key = `mp_${mpId}_${relativePath}`;
    const cached = previewCache.get(key);
    if (cached && cached.version === version) return cached.blobUrl;
    const blob = base64ToBlob(data);
    const blobUrl = URL.createObjectURL(blob);
    if (cached) URL.revokeObjectURL(cached.blobUrl);
    previewCache.delete(key);
    previewCache.set(key, { blobUrl, version });
    evictPreviewCache();
    return blobUrl;
  } catch {
    return null;
  }
}

export async function getDocumentSummaryByDocumentId(documentId: number): Promise<{ summary: string }> {
  const response = await invoke<string>('get_document_summary_by_id', { documentId });
  const data = await parsePythonResponse(response);
  return { summary: typeof data?.summary === 'string' ? data.summary : '' };
}

export async function getDocumentPreviewByDocumentId(documentId: number): Promise<string | null> {
  try {
    const response = await invoke<string>('get_document_preview_by_id', { documentId });
    const result = JSON.parse(response.trim());
    if (!result.success || typeof result.data !== 'string') return null;
    const data = result.data as string;
    const version = typeof result.version === 'string' ? result.version : '';
    const key = `doc_${documentId}`;
    const cached = previewCache.get(key);
    if (cached && cached.version === version) return cached.blobUrl;
    const blob = base64ToBlob(data);
    const blobUrl = URL.createObjectURL(blob);
    if (cached) URL.revokeObjectURL(cached.blobUrl);
    previewCache.delete(key);
    previewCache.set(key, { blobUrl, version });
    evictPreviewCache();
    return blobUrl;
  } catch {
    return null;
  }
}

export async function selectFolder(): Promise<string | null> {
  try {
    const selected = await open({
      directory: true,
      multiple: false
    });
    if (selected && typeof selected === 'string') {
      return selected;
    }
    return null;
  } catch (error) {
    console.error('Folder selection error:', error);
    return null;
  }
}

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'md', 'txt', 'jpg', 'jpeg', 'png', 'ppt', 'pptx', 'wps', 'rtf'];
const DOCUMENT_FILTER = { name: 'Documents', extensions: DOCUMENT_EXTENSIONS };

export async function selectFile(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [DOCUMENT_FILTER]
    });
    if (selected && typeof selected === 'string') return selected;
    return null;
  } catch (error) {
    console.error('File selection error:', error);
    return null;
  }
}

export async function selectFiles(): Promise<string[]> {
  try {
    const selected = await open({
      multiple: true,
      filters: [DOCUMENT_FILTER]
    });
    if (selected == null) return [];
    if (typeof selected === 'string') return [selected];
    return Array.isArray(selected) ? selected : [];
  } catch (error) {
    console.error('File selection error:', error);
    return [];
  }
}

export async function uploadDocument(filePath: string): Promise<any> {
  try {
    const response = await invoke<string>('upload_document', { filePath });
    return await parsePythonResponse(response);
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

export async function importFileToDataCenter(
  mountPointPath: string,
  relativePath: string,
  targetDirectoryId?: number | null
): Promise<{ documentId: number }> {
  const separator = mountPointPath.includes('/') ? '/' : '\\';
  const cleanMount = mountPointPath.replace(/[/\\]+$/, '');
  const cleanRelative = relativePath.replace(/^[/\\]+/, '');
  const fullPath = `${cleanMount}${separator}${cleanRelative}`;

  const result = await uploadDocument(fullPath);
  const documentId = result?.document_id ?? result?.id;
  if (documentId == null) throw new Error('Upload succeeded but no document ID returned');

  if (targetDirectoryId != null) {
    await moveDocument(documentId, targetDirectoryId);
  }

  return { documentId };
}

export async function getDocuments(): Promise<Document[]> {
  try {
    const response = await invoke<string>('get_documents');
    const data = await parsePythonResponse(response);
    return data || [];
  } catch (error) {
    console.error('Get documents error:', error);
    return [];
  }
}

export async function deleteDocument(documentId: number): Promise<void> {
  try {
    const response = await invoke<string>('delete_document', { documentId });
    await parsePythonResponse(response);
  } catch (error) {
    console.error('Delete document error:', error);
    throw error;
  }
}

export interface KnowledgePoint {
  id?: number;
  content: string;
  document_id: number;
  document_name: string;
  chunk_index: number;
  weight?: number;
  excluded?: boolean;
  is_manual?: boolean;
  keywords?: string[];
}

export interface PaginatedResponse<T> {
  knowledge_points: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function getKnowledgePoints(
  page: number = 1,
  pageSize: number = 50,
  documentId?: number,
  minWeight?: number
): Promise<PaginatedResponse<KnowledgePoint>> {
  try {
    const payload: { page: number; pageSize: number; documentId?: number | null; minWeight?: number | null } = {
      page,
      pageSize,
      minWeight: minWeight ?? null
    };
    if (documentId !== undefined && documentId !== null) {
      payload.documentId = Number(documentId);
    }
    const response = await invoke<string>('get_knowledge_points', payload);
    const data = await parsePythonResponse(response);
    return {
        knowledge_points: data?.knowledge_points ?? [],
        total: data?.total ?? 0,
        page: data?.page ?? 1,
        page_size: data?.page_size ?? 50
    };
  } catch (error) {
    console.error('Get knowledge points error:', error);
    return { knowledge_points: [], total: 0, page: 1, page_size: 50 };
  }
}

const GRAPH_PAGE_SIZE = 500;
const GRAPH_MAX_POINTS = 2000;

async function fetchKnowledgePointsPageForGraph(page: number, minWeight: number): Promise<PaginatedResponse<KnowledgePoint>> {
  const w = Math.max(1, Math.min(5, Number(minWeight)));
  const response = await invoke<string>('get_knowledge_points_for_graph', { page, minWeight: w });
  const data = await parsePythonResponse(response);
  return {
    knowledge_points: data?.knowledge_points ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    page_size: data?.page_size ?? GRAPH_PAGE_SIZE,
  };
}

export async function getKnowledgePointsForGraph(minWeight: number = 1): Promise<KnowledgePoint[]> {
  const out: KnowledgePoint[] = [];
  let page = 1;
  let total = 0;
  const w = Math.max(1, Math.min(5, Number(minWeight)));
  do {
    const res = await fetchKnowledgePointsPageForGraph(page, w);
    out.push(...(res.knowledge_points ?? []));
    total = res.total ?? 0;
    if ((res.knowledge_points?.length ?? 0) === 0 || out.length >= GRAPH_MAX_POINTS) break;
    page += 1;
  } while ((page - 1) * GRAPH_PAGE_SIZE < total && out.length < GRAPH_MAX_POINTS);
  return out;
}

export async function createKnowledgePoint(documentId: number, content: string): Promise<KnowledgePoint> {
  try {
    const response = await invoke<string>('create_knowledge_point', {
      documentId,
      content: content.trim()
    });
    const data = await parsePythonResponse(response);
    if (data?.id == null) throw new Error(data?.error ?? 'Create failed');
    return {
      id: data.id,
      content: data.content ?? content,
      document_id: data.document_id ?? documentId,
      document_name: data.document_name ?? '',
      chunk_index: data.chunk_index ?? 0,
      weight: data.weight,
      excluded: data.excluded,
      is_manual: true
    };
  } catch (error) {
    console.error('Create knowledge point error:', error);
    throw error;
  }
}

export async function deleteKnowledgePoints(ids: number[]): Promise<{ deleted?: number }> {
  try {
    const response = await invoke<string>('delete_knowledge_points_batch', { ids });
    const data = await parsePythonResponse(response);
    return { deleted: data?.deleted ?? 0 };
  } catch (error) {
    console.error('Delete knowledge points error:', error);
    throw error;
  }
}

export async function updateKnowledgePointWeight(id: number, weight: number): Promise<{ id: number; weight: number }> {
  try {
    const response = await invoke<string>('update_knowledge_point_weight', { kpId: id, weight });
    const data = await parsePythonResponse(response);
    return { id: data?.id ?? id, weight: data?.weight ?? weight };
  } catch (error) {
    console.error('Update knowledge point weight error:', error);
    throw error;
  }
}

export async function updateKnowledgePointExcluded(id: number, excluded: boolean): Promise<{ id: number; excluded: boolean }> {
  try {
    const response = await invoke<string>('update_knowledge_point_excluded', { kpId: id, excluded });
    const data = await parsePythonResponse(response);
    return { id: data?.id ?? id, excluded: data?.excluded ?? excluded };
  } catch (error) {
    console.error('Update knowledge point excluded error:', error);
    throw error;
  }
}

export async function addKnowledgePointKeyword(kpId: number, keyword: string): Promise<{ id: number; keywords: string[] }> {
  try {
    const response = await invoke<string>('add_knowledge_point_keyword', { kpId, keyword });
    const data = await parsePythonResponse(response);
    return { id: data?.id ?? kpId, keywords: data?.keywords ?? [] };
  } catch (error) {
    console.error('Add knowledge point keyword error:', error);
    throw error;
  }
}

export async function removeKnowledgePointKeyword(kpId: number, keyword: string): Promise<{ id: number; keywords: string[] }> {
  try {
    const response = await invoke<string>('remove_knowledge_point_keyword', { kpId, keyword });
    const data = await parsePythonResponse(response);
    return { id: data?.id ?? kpId, keywords: data?.keywords ?? [] };
  } catch (error) {
    console.error('Remove knowledge point keyword error:', error);
    throw error;
  }
}

export async function getKnowledgePointKeywords(kpId: number): Promise<{ id: number; keywords: string[] }> {
  try {
    const response = await invoke<string>('get_knowledge_point_keywords', { kpId });
    const data = await parsePythonResponse(response);
    return { id: data?.id ?? kpId, keywords: data?.keywords ?? [] };
  } catch (error) {
    console.error('Get knowledge point keywords error:', error);
    throw error;
  }
}

export async function generateAnnotations(
  knowledgePoints: string[] | KnowledgePoint[],
  apiKeyOrPlatform: string,
  model: string = 'deepseek-chat',
  baseUrl?: string,
  platform?: string,
  candidateCount: number = 1
): Promise<Annotation[]> {
  const kpContents = knowledgePoints.map(kp =>
    typeof kp === 'string' ? kp : kp.content
  );
  const safeCandidateCount = Math.max(1, Math.min(10, Number(candidateCount) || 1));
  try {
    const response = await invoke<string>('generate_annotations', {
      knowledgePoints: kpContents,
      apiKey: apiKeyOrPlatform,
      model,
      baseUrl: baseUrl ?? null,
      platform: platform ?? null,
      candidateCount: safeCandidateCount
    });
    const data = await parsePythonResponse(response);
    if (data?.error) {
      throw new Error(data.error);
    }
    return data?.annotations || [];
  } catch (error) {
    console.error('Generate annotations error:', error);
    throw error;
  }
}

export async function estimateFinetuningCost(
  datasetSize: number,
  model: string,
  platform: string
): Promise<any> {
  try {
    const response = await invoke<string>('estimate_finetuning_cost', {
      datasetSize,
      model,
      platform
    });
    return await parsePythonResponse(response);
  } catch (error) {
    console.error('Estimate cost error:', error);
    throw error;
  }
}

export async function submitFinetuningJob(
  annotations: Annotation[],
  platform: string,
  model: string,
  apiKey: string = '',
  formatType: string = 'sft'
): Promise<FinetuningJob> {
  try {
    const response = await invoke<string>('submit_finetuning_job', {
      annotations,
      platform,
      model,
      apiKey: apiKey ?? '',
      formatType
    });
    return await parsePythonResponse(response);
  } catch (error) {
    console.error('Submit finetuning job error:', error);
    throw error;
  }
}

export async function getFinetuningJobs(): Promise<FinetuningJob[]> {
  try {
    const response = await invoke<string>('get_finetuning_jobs');
    const data = await parsePythonResponse(response);
    return data || [];
  } catch (error) {
    console.error('Get finetuning jobs error:', error);
    return [];
  }
}

export async function getJobLogs(jobId: string, limit: number = 100): Promise<any> {
  try {
    const response = await invoke<string>('get_job_logs', { jobId, limit });
    return await parsePythonResponse(response);
  } catch (error) {
    console.error('Get job logs error:', error);
    throw error;
  }
}

export async function getJobStatus(jobId: string): Promise<any> {
  try {
    const response = await invoke<string>('get_job_status', { jobId });
    return await parsePythonResponse(response);
  } catch (error) {
    console.error('Get job status error:', error);
    throw error;
  }
}

export async function startPythonBackend(): Promise<void> {
  try {
    await invoke('start_python_backend');
  } catch (error) {
    console.error('Start Python backend error:', error);
    throw error;
  }
}

export async function saveApiKey(platform: string, apiKey: string): Promise<void> {
  const response = await invoke<string>('save_api_key', { platform, apiKey });
  await parsePythonResponse(response);
}

export async function getApiKeys(): Promise<{ platform: string; encrypted: boolean }[]> {
  try {
    const response = await invoke<string>('get_api_keys');
    const data = await parsePythonResponse(response);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Get API keys error:', error);
    return [];
  }
}

export async function saveTrainingSet(
  annotations: Annotation[],
  trainingItemId?: number
): Promise<{ count: number }> {
  const response = await invoke<string>('save_training_set', {
    annotations,
    trainingItemId: trainingItemId ?? null
  });
  const data = await parsePythonResponse(response);
  return { count: data?.count ?? annotations.length };
}

export async function getTrainingSet(trainingItemId?: number): Promise<{ annotations: Annotation[]; count: number }> {
  try {
    const response = await invoke<string>('get_training_set', { trainingItemId: trainingItemId ?? null });
    const data = await parsePythonResponse(response);
    return {
      annotations: data?.annotations ?? [],
      count: data?.count ?? 0
    };
  } catch (error) {
    console.error('Get training set error:', error);
    return { annotations: [], count: 0 };
  }
}

export async function getTrainingItems(): Promise<TrainingItem[]> {
  try {
    const response = await invoke<string>('get_training_items');
    const data = await parsePythonResponse(response);
    return Array.isArray(data?.items) ? data.items : [];
  } catch (error) {
    console.error('Get training items error:', error);
    return [];
  }
}

export async function saveTrainingItem(payload: {
  name: string;
  knowledgePointKeys: string[];
  promptTemplate: string;
}): Promise<TrainingItem> {
  const response = await invoke<string>('save_training_item', {
    name: payload.name,
    knowledgePointKeys: payload.knowledgePointKeys,
    promptTemplate: payload.promptTemplate
  });
  const data = await parsePythonResponse(response);
  if (!data?.id) {
    throw new Error('Save training item failed');
  }
  return data as TrainingItem;
}

export async function deleteTrainingItem(itemId: number): Promise<void> {
  const response = await invoke<string>('delete_training_item', { itemId });
  await parsePythonResponse(response);
}

export async function getAuditLog(limit: number = 200): Promise<{ entries: any[] }> {
  try {
    const response = await invoke<string>('get_audit_log', { limit });
    const data = await parsePythonResponse(response);
    return { entries: data?.entries ?? [] };
  } catch (error) {
    console.error('Get audit log error:', error);
    return { entries: [] };
  }
}

export async function getDesensitizationLog(limit: number = 100): Promise<{ entries: any[] }> {
  try {
    const response = await invoke<string>('get_desensitization_log', { limit });
    const data = await parsePythonResponse(response);
    return { entries: data?.entries ?? [] };
  } catch (error) {
    console.error('Get desensitization log error:', error);
    return { entries: [] };
  }
}

export async function selectMdTemplateFile(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (selected && typeof selected === 'string') return selected;
    return null;
  } catch (error) {
    console.error('Select MD template error:', error);
    return null;
  }
}

export async function readTemplateFileContent(filePath: string): Promise<string> {
  const content = await invoke<string>('read_template_file', { filePath });
  return content;
}

export async function saveExportFile(filePath: string, contentsBase64: string): Promise<void> {
  await invoke('write_export_file', { filePath, contentsBase64 });
}

export async function selectExportPath(format: 'word' | 'pdf'): Promise<string | null> {
  const ext = format === 'word' ? 'docx' : 'pdf';
  const defaultName = `evaluation-report.${ext}`;
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: format === 'word' ? 'Word' : 'PDF', extensions: [ext] }]
  });
  return selected && typeof selected === 'string' ? selected : null;
}

export async function evaluationGenerate(
  prompt: string,
  template: string = 'custom',
  apiKey?: string,
  platform?: string
): Promise<{ prompt: string; generated_content: string; template: string }> {
  const response = await invoke<string>('evaluation_generate', {
    prompt,
    template,
    apiKey: apiKey ?? null,
    platform: platform ?? null
  });
  return await parsePythonResponse(response);
}

export async function getLocalModels(baseUrl?: string): Promise<string[]> {
  try {
    const response = await invoke<string>('get_local_models', { baseUrl: baseUrl ?? null });
    const data = await parsePythonResponse(response);
    return data?.models ?? [];
  } catch (error) {
    console.error('Get local models error:', error);
    return [];
  }
}

export async function chatQuery(
  query: string,
  apiKey?: string,
  model: string = 'deepseek-chat',
  baseUrl?: string,
  platform?: string
): Promise<{ answer: string; context: string; sources: any[] }> {
  const response = await invoke<string>('chat_query', {
    query,
    apiKey: apiKey ?? null,
    model,
    baseUrl: baseUrl ?? null,
    platform: platform ?? null
  });
  return await parsePythonResponse(response);
}

export async function readChatHistory(): Promise<string> {
  return invoke<string>('read_chat_history');
}

export async function writeChatHistory(contents: string): Promise<void> {
  await invoke('write_chat_history', { contents });
}