import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export interface Document {
  id: number;
  filename: string;
  fileType: string;
  uploadTime: string;
  processed: boolean;
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

async function parsePythonResponse(response: string): Promise<any> {
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

export async function getKnowledgePoints(): Promise<string[]> {
  try {
    const response = await invoke<string>('get_knowledge_points');
    const data = await parsePythonResponse(response);
    return data?.knowledge_points ?? [];
  } catch (error) {
    console.error('Get knowledge points error:', error);
    return [];
  }
}

export async function generateAnnotations(
  knowledgePoints: string[],
  apiKey: string,
  model: string = 'deepseek-chat'
): Promise<Annotation[]> {
  try {
    const response = await invoke<string>('generate_annotations', {
      knowledgePoints,
      apiKey,
      model
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
