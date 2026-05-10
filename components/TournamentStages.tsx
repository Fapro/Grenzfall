import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const STAGES = [
  {
    id: 'groups',
    label: 'Group\nStage',
    teams: '48 teams\n12 groups',
    title: 'Group Stage Diagram',
    summary: 'Each group contains 4 teams. The top 2 sides move into the knockout bracket.',
    diagramColumns: ['Group A', 'Group B', 'Group C', 'Top 2 advance'],
    diagramRows: [
      ['Team 1', 'Team 5', 'Team 9', 'A1, A2'],
      ['Team 2', 'Team 6', 'Team 10', 'B1, B2'],
      ['Team 3', 'Team 7', 'Team 11', 'C1, C2'],
      ['Team 4', 'Team 8', 'Team 12', '...'],
    ],
  },
  {
    id: 'round16',
    label: 'Round of 16',
    teams: '16 teams',
    title: 'Round of 16 Diagram',
    summary: 'Qualified teams enter single-elimination matches. Winners move on immediately.',
    diagramColumns: ['Match 1', 'Match 2', 'Match 3', 'Match 4'],
    diagramRows: [
      ['A1 vs B2', 'C1 vs D2', 'E1 vs F2', 'G1 vs H2'],
      ['B1 vs A2', 'D1 vs C2', 'F1 vs E2', 'H1 vs G2'],
    ],
  },
  {
    id: 'quarters',
    label: 'Quarter-\nfinals',
    teams: '8 teams',
    title: 'Quarter-final Diagram',
    summary: 'Eight teams remain. Every match decides one semi-finalist.',
    diagramColumns: ['QF 1', 'QF 2', 'QF 3', 'QF 4'],
    diagramRows: [
      ['Winner M1', 'Winner M3', 'Winner M5', 'Winner M7'],
      ['Winner M2', 'Winner M4', 'Winner M6', 'Winner M8'],
    ],
  },
  {
    id: 'semis',
    label: 'Semi-\nfinals',
    teams: '4 teams',
    title: 'Semi-final Diagram',
    summary: 'Two semi-finals decide who reaches the world title match.',
    diagramColumns: ['Semi-final 1', 'Semi-final 2'],
    diagramRows: [
      ['Winner QF1 vs Winner QF2', 'Winner QF3 vs Winner QF4'],
      ['Finalist 1', 'Finalist 2'],
    ],
  },
  {
    id: 'final',
    label: 'Final',
    teams: '2 teams',
    title: 'Final Diagram',
    summary: 'The last two teams play for the FIFA World Cup trophy.',
    diagramColumns: ['The Final'],
    diagramRows: [['Winner SF1 vs Winner SF2'], ['World Champion']],
  },
];

const HIERARCHY_LEVELS = [
  { id: 'final', label: 'Final', items: ['World Cup Final'] },
  { id: 'semis', label: 'Semi-finals', items: ['Semi-final 1', 'Semi-final 2'] },
  {
    id: 'quarters',
    label: 'Quarter-finals',
    items: ['QF 1', 'QF 2', 'QF 3', 'QF 4'],
  },
  {
    id: 'round16',
    label: 'Round of 16',
    items: ['R16 1', 'R16 2', 'R16 3', 'R16 4'],
  },
  {
    id: 'groups',
    label: 'Group Stage',
    items: ['A-C', 'D-F', 'G-I', 'J-L'],
  },
] as const;

type GroupRangeId = 'A-C' | 'D-F' | 'G-I' | 'J-L';

const GROUP_RANGE_LETTERS: Record<GroupRangeId, string[]> = {
  'A-C': ['A', 'B', 'C'],
  'D-F': ['D', 'E', 'F'],
  'G-I': ['G', 'H', 'I'],
  'J-L': ['J', 'K', 'L'],
};

type GroupStageData = {
  groupLetter: string;
  teams: string[];
  results: string[];
  groups?: Record<
    string,
    {
      teams: string[];
      results: string[];
    }
  >;
};

type GroupRangeData = {
  rangeId: GroupRangeId;
  label: string;
  teams: string[];
  results: string[];
};

type GroupLetterSection = {
  letter: string;
  teams: string[];
  results: string[];
};

type TournamentStagesProps = {
  groupStageData?: GroupStageData;
};

function inferRangeFromGroupLetter(letter: string): GroupRangeId {
  const upper = letter.toUpperCase();
  if (GROUP_RANGE_LETTERS['A-C'].includes(upper)) return 'A-C';
  if (GROUP_RANGE_LETTERS['D-F'].includes(upper)) return 'D-F';
  if (GROUP_RANGE_LETTERS['G-I'].includes(upper)) return 'G-I';
  return 'J-L';
}

function createEmptyGroupRangeData(rangeId: GroupRangeId): GroupRangeData {
  return {
    rangeId,
    label: `Groups ${rangeId}`,
    teams: [],
    results: [],
  };
}

export function TournamentStages({ groupStageData }: TournamentStagesProps) {
  const { width } = useWindowDimensions();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [selectedGroupRange, setSelectedGroupRange] = useState<GroupRangeId>(
    inferRangeFromGroupLetter(groupStageData?.groupLetter ?? 'A')
  );

  const selectedStage = useMemo(
    () => STAGES.find((stage) => stage.id === selectedStageId) ?? null,
    [selectedStageId]
  );
  const useWrappedStageLayout = width >= 900;
  const isCompactModal = width < 720;
  const modalInnerWidth = Math.min(width - 60, 860) - (isCompactModal ? 28 : 36);
  const diagramColumnCount = selectedStage?.diagramColumns.length ?? 1;
  const diagramCellMinWidth = Math.max(
    96,
    Math.floor((modalInnerWidth - Math.max(0, (diagramColumnCount - 1) * 8) - 20) / diagramColumnCount)
  );

  useEffect(() => {
    if (groupStageData?.groupLetter) {
      setSelectedGroupRange(inferRangeFromGroupLetter(groupStageData.groupLetter));
    }
  }, [groupStageData?.groupLetter]);

  const selectedRangeLetters = GROUP_RANGE_LETTERS[selectedGroupRange] ?? [];
  const hasDataForSelectedRange =
    !!groupStageData?.groupLetter &&
    selectedRangeLetters.includes(groupStageData.groupLetter.toUpperCase());

  const selectedGroupRangeData = useMemo(() => {
    const baseData = createEmptyGroupRangeData(selectedGroupRange);
    if (!groupStageData?.groupLetter) {
      return baseData;
    }

    const groupLetter = groupStageData.groupLetter.toUpperCase();
    if (!selectedRangeLetters.includes(groupLetter)) {
      return baseData;
    }

    return {
      ...baseData,
      teams: groupStageData.teams,
      results: groupStageData.results,
    };
  }, [groupStageData, selectedGroupRange, selectedRangeLetters]);

  const selectedRangeSections = useMemo<GroupLetterSection[]>(() => {
    return selectedRangeLetters.map((letter) => {
      const fromAllGroups = groupStageData?.groups?.[letter];
      const isLoadedGroup = groupStageData?.groupLetter?.toUpperCase() === letter;
      return {
        letter,
        teams: fromAllGroups?.teams ?? (isLoadedGroup ? selectedGroupRangeData.teams : []),
        results: fromAllGroups?.results ?? (isLoadedGroup ? selectedGroupRangeData.results : []),
      };
    });
  }, [groupStageData?.groupLetter, groupStageData?.groups, selectedGroupRangeData.results, selectedGroupRangeData.teams, selectedRangeLetters]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FIFA World Cup 2026</Text>
      <Text style={styles.subtitle}>Tournament Structure</Text>

      {useWrappedStageLayout ? (
        <View style={styles.stagesWrapGrid}>
          {STAGES.map((stage) => (
            <Pressable
              key={stage.id}
              style={({ pressed }) => [
                styles.stageBox,
                styles.stageBoxGrid,
                pressed ? styles.stageBoxPressed : null,
              ]}
              onPress={() => setSelectedStageId(stage.id)}
            >
              <Text style={styles.stageLabel}>{stage.label}</Text>
              <Text style={styles.stageTeams}>{stage.teams}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.stagesRow}>
            {STAGES.map((stage, index) => (
              <View key={stage.id} style={styles.stageWrapper}>
                <Pressable
                  style={({ pressed }) => [
                    styles.stageBox,
                    pressed ? styles.stageBoxPressed : null,
                  ]}
                  onPress={() => setSelectedStageId(stage.id)}
                >
                  <Text style={styles.stageLabel}>{stage.label}</Text>
                  <Text style={styles.stageTeams}>{stage.teams}</Text>
                </Pressable>

                {index < STAGES.length - 1 && (
                  <View style={styles.arrowContainer}>
                    <Text style={styles.arrow}>→</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>2026 Format:</Text>
        <Text style={styles.legendText}>🏟 16 stadiums across USA, Canada, and Mexico</Text>
        <Text style={styles.legendText}>📅 June - July 2026</Text>
        <Text style={styles.legendText}>🎯 80 total matches</Text>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={selectedStage != null}
        onRequestClose={() => setSelectedStageId(null)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              isCompactModal ? styles.modalCardCompact : null,
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStage?.title}</Text>
                <Text style={styles.modalSummary}>{selectedStage?.summary}</Text>
              </View>
              <Pressable
                style={styles.closeButton}
                onPress={() => setSelectedStageId(null)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.diagramScrollContent}
            >
              <View style={styles.diagramFrame}> 
                {HIERARCHY_LEVELS.map((level, levelIndex) => {
                  const isSelectedLevel = selectedStage?.id === level.id;
                  return (
                    <View key={level.id} style={styles.hierarchyLevelBlock}>
                      <Text
                        style={[
                          styles.hierarchyLevelTitle,
                          isSelectedLevel ? styles.hierarchyLevelTitleActive : null,
                        ]}
                      >
                        {level.label}
                      </Text>

                      <View style={styles.hierarchyRow}>
                        {level.items.map((item) => {
                          const groupItem = level.id === 'groups' ? (item as GroupRangeId) : null;
                          const isGroupItemSelected = groupItem !== null && groupItem === selectedGroupRange;
                          const nodeLabel = groupItem ? `Groups ${groupItem}` : item;
                          return (
                          <Pressable
                            key={item}
                            onPress={() => {
                              if (groupItem) {
                                setSelectedGroupRange(groupItem);
                              }
                            }}
                            style={[
                              styles.hierarchyNode,
                              { minWidth: diagramCellMinWidth },
                              isSelectedLevel ? styles.hierarchyNodeActive : null,
                              isGroupItemSelected
                                ? styles.hierarchyNodeRangeActive
                                : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.hierarchyNodeText,
                                isSelectedLevel ? styles.hierarchyNodeTextActive : null,
                                isGroupItemSelected
                                  ? styles.hierarchyNodeTextRangeActive
                                  : null,
                              ]}
                            >
                              {nodeLabel}
                            </Text>
                          </Pressable>
                        );})}
                      </View>

                      {levelIndex < HIERARCHY_LEVELS.length - 1 && (
                        <View style={styles.hierarchyConnectorWrap}>
                          <View style={styles.hierarchyConnector} />
                          <Text style={styles.hierarchyConnectorArrow}>↑</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {selectedStage?.id === 'groups' && (
              <View style={styles.groupDataPanel}>
                <Text style={styles.groupDataTitle}>Group Stage Data · {selectedGroupRangeData.label}</Text>
                {selectedRangeSections.map((section) => (
                  <View key={section.letter} style={styles.groupLetterSection}>
                    <Text style={styles.groupLetterTitle}>Group {section.letter}</Text>

                    <Text style={styles.groupDataSubtitle}>Teams</Text>
                    {section.teams.length > 0 ? (
                      section.teams.map((teamName) => (
                        <Text key={`${section.letter}-${teamName}`} style={styles.groupDataLine}>• {teamName}</Text>
                      ))
                    ) : (
                      <Text style={styles.groupDataEmpty}>No team data loaded for this group yet.</Text>
                    )}

                    <Text style={[styles.groupDataSubtitle, styles.groupDataSubtitleResults]}>Results</Text>
                    {section.results.length > 0 ? (
                      section.results.map((resultLine) => (
                        <Text key={`${section.letter}-${resultLine}`} style={styles.groupDataLine}>• {resultLine}</Text>
                      ))
                    ) : (
                      <Text style={styles.groupDataEmpty}>No results loaded for this group yet.</Text>
                    )}
                  </View>
                ))}

                {!hasDataForSelectedRange && (
                  <Text style={styles.groupDataEmpty}>
                    Select a team from groups {selectedRangeLetters.join(', ')} to load real fixtures for this range.
                  </Text>
                )}
              </View>
            )}

            <Text style={styles.modalFootnote}>
              This schematic view is a visual tournament guide for the selected stage.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(20, 35, 20, 0.9)',
    borderRadius: 12,
    padding: 14,
    borderColor: '#2e7d32',
    borderWidth: 1,
    marginVertical: 12,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollContent: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  stagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stagesWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  stageWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageBox: {
    backgroundColor: 'rgba(10, 10, 10, 0.8)',
    borderRadius: 8,
    padding: 10,
    borderColor: '#4caf50',
    borderWidth: 1.5,
    minWidth: 85,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageBoxGrid: {
    width: '48%',
    minWidth: 0,
  },
  stageBoxPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.88,
  },
  stageLabel: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  stageTeams: {
    color: '#b3e5b3',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 13,
  },
  tapHint: {
    color: '#7ca780',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  arrowContainer: {
    marginHorizontal: 2,
  },
  arrow: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: '600',
  },
  legendContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: '#2b3a2c',
    borderTopWidth: 1,
  },
  legendTitle: {
    color: '#9cd6a0',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  legendText: {
    color: '#b3e5b3',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    lineHeight: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 8, 4, 0.74)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 860,
    borderRadius: 18,
    padding: 18,
    backgroundColor: '#0f1711',
    borderColor: '#2e7d32',
    borderWidth: 1,
  },
  modalCardCompact: {
    padding: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  modalSummary: {
    color: '#b3e5b3',
    fontSize: 13,
    lineHeight: 18,
    maxWidth: 560,
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(76, 175, 80, 0.14)',
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  closeButtonText: {
    color: '#d9f1da',
    fontSize: 12,
    fontWeight: '700',
  },
  diagramScrollContent: {
    marginTop: 18,
  },
  diagramFrame: {
    borderRadius: 14,
    backgroundColor: '#0a0f0b',
    borderWidth: 1,
    borderColor: '#29412d',
    padding: 10,
  },
  hierarchyLevelBlock: {
    alignItems: 'center',
  },
  hierarchyLevelTitle: {
    color: '#7ea083',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  hierarchyLevelTitleActive: {
    color: '#dff5e1',
  },
  hierarchyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'nowrap',
  },
  hierarchyNode: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minHeight: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#35543a',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  hierarchyNodeActive: {
    borderColor: '#7edb86',
    backgroundColor: 'rgba(76, 175, 80, 0.18)',
    shadowColor: '#6ad274',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
  },
  hierarchyNodeRangeActive: {
    borderColor: '#9ce2a5',
    backgroundColor: 'rgba(120, 214, 130, 0.22)',
  },
  hierarchyNodeText: {
    color: '#eef7ef',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  hierarchyNodeTextActive: {
    color: '#ffffff',
  },
  hierarchyNodeTextRangeActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  hierarchyConnectorWrap: {
    alignItems: 'center',
    marginVertical: 8,
  },
  hierarchyConnector: {
    width: 2,
    height: 16,
    backgroundColor: '#3d6b44',
  },
  hierarchyConnectorArrow: {
    color: '#6ba873',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
  },
  modalFootnote: {
    marginTop: 12,
    color: '#7ea083',
    fontSize: 11,
    lineHeight: 16,
  },
  groupDataPanel: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#33553a',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    padding: 12,
  },
  groupDataTitle: {
    color: '#dff5e1',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  groupLetterSection: {
    borderTopWidth: 1,
    borderTopColor: '#33553a',
    paddingTop: 10,
    marginTop: 10,
  },
  groupLetterTitle: {
    color: '#eaf7ec',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  groupDataSubtitle: {
    color: '#9cd6a0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  groupDataSubtitleResults: {
    marginTop: 8,
  },
  groupDataLine: {
    color: '#e8f6e9',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 2,
  },
  groupDataEmpty: {
    color: '#aac5ad',
    fontSize: 12,
    lineHeight: 17,
  },
});
