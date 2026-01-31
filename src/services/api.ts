import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

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
}

export interface Annotation {
  id?: number;
  instruction: string;
  response: string;
  question?: string;
  answer?: string;
  score?: number;
  formatType?: string;
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

export async function selectFile(): Promise<string | null> {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Documents',
        extensions: ['pdf', 'doc', 'docx', 'md', 'txt', 'jpg', 'jpeg', 'png']
      }]
    });
    
    if (selected && typeof selected === 'string') {
      return selected;
    }
    return null;
  } catch (error) {
    console.error('File selection error:', error);
    return null;
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
  content: string;
  document_id: number;
  document_name: string;
  chunk_index: number;
}

export interface PaginatedResponse<T> {
  knowledge_points: T[];
  total: number;
  page: number;
  page_size: number;
}

export async function getKnowledgePoints(page: number = 1, pageSize: number = 50, documentId?: number): Promise<PaginatedResponse<KnowledgePoint>> {
  try {
    const response = await invoke<string>('get_knowledge_points', {
        page,
        pageSize,
        documentId: documentId ?? null
    });
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

export async function generateAnnotations(
  knowledgePoints: string[] | KnowledgePoint[],
  apiKey: string,
  model: string = 'deepseek-chat',
  baseUrl?: string
): Promise<Annotation[]> {
  // Extract content string if input is KnowledgePoint object
  const kpContents = knowledgePoints.map(kp => 
    typeof kp === 'string' ? kp : kp.content
  );
  
  try {
    const response = await invoke<string>('generate_annotations', {
      knowledgePoints: kpContents,
      apiKey,
      model,
      baseUrl: baseUrl ?? null
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
  apiKey: string,
  formatType: string = 'sft'
): Promise<FinetuningJob> {
  try {
    const response = await invoke<string>('submit_finetuning_job', {
      annotations,
      platform,
      model,
      apiKey,
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

export async function saveTrainingSet(annotations: Annotation[]): Promise<{ count: number }> {
  const response = await invoke<string>('save_training_set', { annotations });
  const data = await parsePythonResponse(response);
  return { count: data?.count ?? annotations.length };
}

export async function getTrainingSet(): Promise<{ annotations: Annotation[]; count: number }> {
  try {
    const response = await invoke<string>('get_training_set');
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

export async function evaluationGenerate(
  prompt: string,
  template: string = 'custom',
  apiKey?: string
): Promise<{ prompt: string; generated_content: string; template: string }> {
  const response = await invoke<string>('evaluation_generate', {
    prompt,
    template,
    apiKey: apiKey ?? null
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
  baseUrl?: string
): Promise<{ answer: string; context: string; sources: any[] }> {
  const response = await invoke<string>('chat_query', {
    query,
    apiKey: apiKey ?? null,
    model,
    baseUrl: baseUrl ?? null
  });
  return await parsePythonResponse(response);
}

