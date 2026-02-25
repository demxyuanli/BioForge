import React from 'react';
import { useProductionTuningLayout } from '../hooks/useProductionTuningLayout';
import { useProductionTuningData } from '../hooks/useProductionTuningData';
import { ProductionTuningDatasetSection } from './ProductionTuning/ProductionTuningDatasetSection';
import { ProductionTuningSavedDataSection } from './ProductionTuning/ProductionTuningSavedDataSection';
import { ProductionTuningJobsSection } from './ProductionTuning/ProductionTuningJobsSection';
import { ProductionTuningInstructionEditDialog } from './ProductionTuning/ProductionTuningInstructionEditDialog';
import './ProductionTuning.css';

interface ProductionTuningProps {
  activeSubItem?: string;
}

const ProductionTuning: React.FC<ProductionTuningProps> = ({ activeSubItem }) => {
  const layout = useProductionTuningLayout();
  const data = useProductionTuningData(activeSubItem);

  const {
    isSplitResizing,
    splitContainerRef,
    splitTemplate,
    handleSplitResizeStart,
  } = layout;

  const {
    loadTrainingSet,
    loadJobs,
    fetchJobDetail,
    openJobDetail,
    handleExpandJob,
    handleRefreshAll,
    handleStartFinetuning,
    handleJumpToFirstLinkedJob,
    openInstructionEditor,
    closeInstructionEditor,
    handleSaveInstructionEdit,
    handleUseAllData,
    instructionEditState,
    setInstructionEditState,
    datasetSectionRef,
    jobsSectionRef,
    ...rest
  } = data;

  return (
    <div
      ref={splitContainerRef}
      className={`production-tuning production-tuning-split ${isSplitResizing ? 'split-resizing' : ''}`}
      style={{ gridTemplateColumns: splitTemplate }}
    >
      <div className="production-pane production-left-pane">
        <ProductionTuningDatasetSection
          defaultPlatform={rest.defaultPlatform}
          defaultCloudModel={rest.defaultCloudModel}
          untunedSavedCount={rest.untunedSavedCount}
          tunedSavedCount={rest.tunedSavedCount}
          effectiveDatasetSize={rest.effectiveDatasetSize}
          submittableCount={rest.submittableCount}
          setDatasetSize={rest.setDatasetSize}
          costEstimate={rest.costEstimate}
          useLocalModel={rest.useLocalModel}
          isLoadingSavedData={rest.isLoadingSavedData}
          isLoadingJobs={rest.isLoadingJobs}
          notice={rest.notice}
          canStartFinetuning={rest.canStartFinetuning}
          isSubmitting={rest.isSubmitting}
          onLoadTrainingSet={(silent) => void loadTrainingSet(silent)}
          onRefreshAll={() => void handleRefreshAll()}
          onStartFinetuning={() => void handleStartFinetuning()}
          onUseAllData={handleUseAllData}
          sectionRef={datasetSectionRef}
        />
        <ProductionTuningSavedDataSection
          savedDataSearch={rest.savedDataSearch}
          setSavedDataSearch={rest.setSavedDataSearch}
          savedDataTuneFilter={rest.savedDataTuneFilter}
          setSavedDataTuneFilter={rest.setSavedDataTuneFilter}
          savedDataScoreFilter={rest.savedDataScoreFilter}
          setSavedDataScoreFilter={rest.setSavedDataScoreFilter}
          filteredSavedAnnotations={rest.filteredSavedAnnotations}
          totalSavedCount={rest.totalSavedCount}
          pagedSavedAnnotations={rest.pagedSavedAnnotations}
          savedDataPage={rest.savedDataPage}
          setSavedDataPage={rest.setSavedDataPage}
          savedDataTotalPages={rest.savedDataTotalPages}
          dataRangeStart={rest.dataRangeStart}
          dataRangeEnd={rest.dataRangeEnd}
          onOpenInstructionEditor={openInstructionEditor}
          onJumpToFirstLinkedJob={(ann) => void handleJumpToFirstLinkedJob(ann)}
        />
      </div>

      <div className="production-divider" onMouseDown={handleSplitResizeStart} />

      <div className="production-pane production-right-pane">
        <ProductionTuningJobsSection
          jobs={rest.jobs}
          expandedJobId={rest.expandedJobId}
          jobLogs={rest.jobLogs}
          jobStatusDetail={rest.jobStatusDetail}
          isRefreshingJobDetail={rest.isRefreshingJobDetail}
          lastDetailRefreshAt={rest.lastDetailRefreshAt}
          autoRefreshJobs={rest.autoRefreshJobs}
          setAutoRefreshJobs={rest.setAutoRefreshJobs}
          isLoadingJobs={rest.isLoadingJobs}
          sectionRef={jobsSectionRef}
          onLoadJobs={(silent) => void loadJobs(silent)}
          onExpandJob={(id) => void handleExpandJob(id)}
          onFetchJobDetail={(id, silent) => void fetchJobDetail(id, silent)}
        />
      </div>

      <ProductionTuningInstructionEditDialog
        state={instructionEditState}
        onClose={closeInstructionEditor}
        onDraftChange={(draft) =>
          setInstructionEditState((prev) =>
            prev ? { ...prev, draft } : null
          )
        }
        onResponseChange={(response) =>
          setInstructionEditState((prev) =>
            prev ? { ...prev, response } : null
          )
        }
        onSave={() => void handleSaveInstructionEdit()}
      />
    </div>
  );
};

export default ProductionTuning;
