import React from 'react';
import { useTrainingLabLayout } from '../hooks/useTrainingLabLayout';
import { useTrainingLabData } from '../hooks/useTrainingLabData';
import { TrainingLabLeftPane } from './TrainingLab/TrainingLabLeftPane';
import { TrainingLabRightPane } from './TrainingLab/TrainingLabRightPane';
import { TrainingLabInstructionEditDialog } from './TrainingLab/TrainingLabInstructionEditDialog';

const TrainingLab: React.FC = () => {
  const layout = useTrainingLabLayout();
  const data = useTrainingLabData();

  const {
    isSplitResizing,
    splitContainerRef,
    splitTemplate,
    handleSplitResizeStart,
  } = layout;

  return (
    <div
      ref={splitContainerRef}
      className={`training-lab training-lab-split ${isSplitResizing ? 'split-resizing' : ''}`}
      style={{ gridTemplateColumns: splitTemplate }}
    >
      <TrainingLabLeftPane
        trainingItems={data.trainingItems}
        activeTrainingItemId={data.activeTrainingItemId}
        minWeightFilter={data.minWeightFilter}
        setMinWeightFilter={data.setMinWeightFilter}
        keywordFilter={data.keywordFilter}
        setKeywordFilter={data.setKeywordFilter}
        contentFilter={data.contentFilter}
        setContentFilter={data.setContentFilter}
        filteredKnowledgePoints={data.filteredKnowledgePoints}
        selectedKnowledgePointKeys={data.selectedKnowledgePointKeys}
        trainingName={data.trainingName}
        setTrainingName={data.setTrainingName}
        promptTemplate={data.promptTemplate}
        setPromptTemplate={data.setPromptTemplate}
        selectedSkillIds={data.selectedSkillIds}
        setSelectedSkillIds={data.setSelectedSkillIds}
        onActivateTrainingItem={data.handleActivateTrainingItem}
        onDeleteTrainingItem={(id) => void data.handleDeleteTrainingItem(id)}
        onToggleKnowledgePointSelection={data.toggleKnowledgePointSelection}
        onSelectAllFiltered={data.handleSelectAllFiltered}
        onClearSelection={data.handleClearSelection}
        onSaveTrainingItem={() => void data.handleSaveTrainingItem()}
      />

      <div className="training-lab-divider" onMouseDown={handleSplitResizeStart} />

      <TrainingLabRightPane
        useLocalModel={data.aiConfig.useLocalModel}
        localModelName={data.aiConfig.localModelName}
        availableLocalModels={data.availableLocalModels}
        isFetchingModels={data.isFetchingModels}
        onFetchLocalModels={() => void data.fetchLocalModels()}
        knowledgePointsLength={data.knowledgePoints.length}
        filteredKnowledgePointsLength={data.filteredKnowledgePoints.length}
        selectedKnowledgePointsSize={data.selectedKnowledgePointKeys.size}
        generationSource={data.generationSource}
        generationPointCount={data.generationPointCount}
        annotations={data.annotations}
        isGenerating={data.isGenerating}
        savingForFinetuning={data.savingForFinetuning}
        candidateCount={data.candidateCount}
        setCandidateCount={data.setCandidateCount}
        onLoadKnowledgePoints={() => void data.loadKnowledgePoints()}
        onGenerateAnnotations={() => void data.handleGenerateAnnotations()}
        onSaveForFinetuning={() => void data.handleSaveForFinetuning()}
        onExportJSONL={data.handleExportJSONL}
        onScoreChange={data.handleScoreChange}
        onScoreMouseDown={data.handleScoreMouseDown}
        onScoreMouseEnter={data.handleScoreMouseEnter}
        onSetIsScoringDrag={data.setIsScoringDrag}
        onOpenInstructionEditor={data.openInstructionEditor}
      />

      <TrainingLabInstructionEditDialog
        state={data.instructionEditState}
        onClose={data.closeInstructionEditor}
        onDraftChange={(draft) =>
          data.setInstructionEditState((prev) => (prev ? { ...prev, draft } : null))
        }
        onResponseChange={(response) =>
          data.setInstructionEditState((prev) => (prev ? { ...prev, response } : null))
        }
        onSave={data.handleSaveInstructionEdit}
      />
    </div>
  );
};

export default TrainingLab;
