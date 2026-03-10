import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clockIn,
  createActivityType,
  createClient,
  createProject,
  createSessionObjectives,
  getActivityTypes,
  getClients,
  getProjects,
  getRecentCombos,
  updateProject,
} from '../database/storage';
import { ActivityType, Client, Project, RecentCombo } from '../database/types';
import { playClockInSound } from '../utils/sounds';

const PALETTE = ['#fe7f2d', '#e91e63', '#4caf50', '#00bcd4', '#9c27b0', '#ffb300', '#60a5fa', '#4ade80'];

type Mode =
  | 'combos'
  | 'client'
  | 'project'
  | 'activity'
  | 'objective'
  | 'add-client'
  | 'add-project'
  | 'add-activity'
  | 'edit-project';

export default function ClockInScreen() {
  const router = useRouter();

  // Navigation
  const [mode, setMode] = useState<Mode>('combos');

  // Picker state
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [combos, setCombos] = useState<RecentCombo[]>([]);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityType | null>(null);
  const [isBillable, setIsBillable] = useState(true);

  // Objective checklist
  const [items, setItems] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');

  // Add / edit forms
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState(PALETTE[0]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Load combos on mount
  useEffect(() => {
    getRecentCombos().then(setCombos).catch(() => {});
  }, []);

  // ── Navigation helpers ──────────────────────────────────────────────────────

  async function startNewSession() {
    setError('');
    setSelectedClient(null);
    setSelectedProject(null);
    setSelectedActivity(null);
    setIsBillable(true);
    try {
      const data = await getClients();
      setClients(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load clients.');
    }
    setMode('client');
  }

  async function handleSelectClient(client: Client) {
    setSelectedClient(client);
    setError('');
    try {
      const data = await getProjects(client.id);
      setProjects(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load projects.');
    }
    setMode('project');
  }

  async function handleSelectProject(project: Project) {
    setSelectedProject(project);
    setError('');
    try {
      const data = await getActivityTypes();
      setActivities(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load activity types.');
    }
    setMode('activity');
  }

  function handleSelectActivity(activity: ActivityType) {
    setSelectedActivity(activity);
    setItems([]);
    setInputText('');
    setMode('objective');
  }

  // ── Quick start from combo ──────────────────────────────────────────────────

  function handleComboStart(combo: RecentCombo) {
    setSelectedClient({ id: combo.client_id, name: combo.client_name, team_id: '', is_internal: false, created_at: '' });
    setSelectedProject({ id: combo.project_id, name: combo.project_name, color: combo.project_color, status: 'active' });
    setSelectedActivity({ id: combo.activity_type_id, name: combo.activity_name, color: combo.activity_color, team_id: '' });
    setIsBillable(true);
    setItems([]);
    setInputText('');
    setMode('objective');
  }

  // ── Start session (from objective step) ────────────────────────────────────

  async function handleStart() {
    if (!selectedProject || !selectedActivity) return;
    try {
      playClockInSound();
      const sessionId = await clockIn(selectedProject.id, selectedActivity.id, {
        clientId: selectedClient?.id,
        isBillable,
      });
      if (items.length > 0) {
        await createSessionObjectives(sessionId, items);
      }
      router.replace('/working');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session.');
      setMode('combos');
    }
  }

  async function handleSkipObjectives() {
    if (!selectedProject || !selectedActivity) return;
    try {
      playClockInSound();
      await clockIn(selectedProject.id, selectedActivity.id, {
        clientId: selectedClient?.id,
        isBillable,
      });
      router.replace('/working');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session.');
      setMode('combos');
    }
  }

  // ── Add Client ──────────────────────────────────────────────────────────────

  function openAddClient() {
    setFormName('');
    setError('');
    setMode('add-client');
  }

  async function handleAddClient() {
    if (!formName.trim()) return;
    setLoading(true);
    try {
      await createClient(formName.trim());
      const data = await getClients();
      setClients(data);
      setFormName('');
      setMode('client');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create client.');
    } finally {
      setLoading(false);
    }
  }

  // ── Add Project ─────────────────────────────────────────────────────────────

  function openAddProject() {
    setFormName('');
    setFormDescription('');
    setFormColor(PALETTE[0]);
    setError('');
    setMode('add-project');
  }

  async function handleAddProject() {
    if (!formName.trim()) return;
    setLoading(true);
    try {
      await createProject(formName.trim(), formColor, formDescription.trim(), selectedClient?.id);
      const data = await getProjects(selectedClient?.id);
      setProjects(data);
      setFormName('');
      setFormDescription('');
      setMode('project');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create project.');
    } finally {
      setLoading(false);
    }
  }

  function openEditProject(project: Project) {
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description ?? '');
    setFormColor(project.color);
    setError('');
    setMode('edit-project');
  }

  async function handleUpdateProject() {
    if (!editingProject || !formName.trim()) return;
    setLoading(true);
    try {
      await updateProject(editingProject.id, formName.trim(), formColor, formDescription.trim());
      const data = await getProjects(selectedClient?.id);
      setProjects(data);
      setMode('project');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update project.');
    } finally {
      setLoading(false);
    }
  }

  // ── Add Activity Type ───────────────────────────────────────────────────────

  function openAddActivity() {
    setFormName('');
    setFormColor(PALETTE[0]);
    setError('');
    setMode('add-activity');
  }

  async function handleAddActivity() {
    if (!formName.trim()) return;
    setLoading(true);
    try {
      await createActivityType(formName.trim(), formColor);
      const data = await getActivityTypes();
      setActivities(data);
      setFormName('');
      setMode('activity');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create activity type.');
    } finally {
      setLoading(false);
    }
  }

  // ── Objective helpers ───────────────────────────────────────────────────────

  function addItem() {
    const text = inputText.trim();
    if (!text) return;
    setItems((prev) => [...prev, text]);
    setInputText('');
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Breadcrumb / back ───────────────────────────────────────────────────────

  function backFrom(current: Mode) {
    const map: Partial<Record<Mode, Mode>> = {
      client: 'combos',
      'add-client': 'client',
      project: 'client',
      'add-project': 'project',
      'edit-project': 'project',
      activity: 'project',
      'add-activity': 'activity',
      objective: 'activity',
    };
    setMode(map[current] ?? 'combos');
    setError('');
  }

  // ── Renders ─────────────────────────────────────────────────────────────────

  // Combos screen
  if (mode === 'combos') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Recent Sessions</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {combos.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent sessions yet.</Text>
              <Text style={styles.emptySubText}>Start your first one below.</Text>
            </View>
          ) : (
            combos.map((combo, i) => (
              <TouchableOpacity
                key={i}
                style={styles.comboCard}
                onPress={() => handleComboStart(combo)}
                activeOpacity={0.8}
              >
                <View style={styles.comboLeft}>
                  <View style={[styles.comboDot, { backgroundColor: combo.project_color }]} />
                  <View style={styles.comboTextGroup}>
                    <Text style={styles.comboProject}>{combo.project_name}</Text>
                    <Text style={styles.comboMeta}>
                      {combo.client_name}  ·  {combo.activity_name}
                    </Text>
                  </View>
                </View>
                <View style={[styles.activityChip, { backgroundColor: combo.activity_color + '25' }]}>
                  <View style={[styles.activityChipDot, { backgroundColor: combo.activity_color }]} />
                </View>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity style={styles.newSessionBtn} onPress={startNewSession} activeOpacity={0.85}>
            <Text style={styles.newSessionText}>+ New Session</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Client picker
  if (mode === 'client') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
          <BackRow onBack={() => backFrom('client')} />
          <Text style={styles.stepHeading}>Select Client</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {clients.map((c) => (
            <TouchableOpacity key={c.id} style={styles.listItem} onPress={() => handleSelectClient(c)} activeOpacity={0.8}>
              <Text style={styles.listItemText}>{c.name}</Text>
              {c.is_internal && <Text style={styles.internalBadge}>Internal</Text>}
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addLineBtn} onPress={openAddClient} activeOpacity={0.75}>
            <Text style={styles.addLineBtnText}>+ Add new client</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Add client form
  if (mode === 'add-client') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
            <BackRow onBack={() => backFrom('add-client')} />
            <Text style={styles.stepHeading}>New Client</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.formLabel}>Client Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Acme Corp"
              placeholderTextColor="#4a6d80"
              value={formName}
              onChangeText={setFormName}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryBtn, (!formName.trim() || loading) && styles.primaryBtnDisabled]}
              onPress={handleAddClient}
              disabled={!formName.trim() || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Create Client</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Project picker
  if (mode === 'project') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
          <BackRow onBack={() => backFrom('project')} />
          {selectedClient && (
            <View style={styles.breadcrumb}>
              <Text style={styles.breadcrumbText}>{selectedClient.name}</Text>
            </View>
          )}
          <Text style={styles.stepHeading}>Select Project</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {projects.length === 0 ? (
            <Text style={styles.emptyText}>No projects for this client yet.</Text>
          ) : (
            projects.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.listItem}
                onPress={() => handleSelectProject(p)}
                activeOpacity={0.8}
              >
                <View style={[styles.listDot, { backgroundColor: p.color }]} />
                <Text style={styles.listItemText}>{p.name}</Text>
                <TouchableOpacity
                  onPress={() => openEditProject(p)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.editBtn}
                >
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.addLineBtn} onPress={openAddProject} activeOpacity={0.75}>
            <Text style={styles.addLineBtnText}>+ Add new project</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Add / edit project form
  if (mode === 'add-project' || mode === 'edit-project') {
    const isEdit = mode === 'edit-project';
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
            <BackRow onBack={() => backFrom(mode)} />
            <Text style={styles.stepHeading}>{isEdit ? 'Edit Project' : 'New Project'}</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.formLabel}>Project Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Website Redesign"
              placeholderTextColor="#4a6d80"
              value={formName}
              onChangeText={setFormName}
              autoFocus
            />
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="What is this project about?"
              placeholderTextColor="#4a6d80"
              value={formDescription}
              onChangeText={setFormDescription}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.formLabel}>Color</Text>
            <View style={styles.colorRow}>
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, formColor === c && styles.colorSelected]}
                  onPress={() => setFormColor(c)}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, (!formName.trim() || loading) && styles.primaryBtnDisabled]}
              onPress={isEdit ? handleUpdateProject : handleAddProject}
              disabled={!formName.trim() || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>{isEdit ? 'Save Changes' : 'Create Project'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Activity type picker
  if (mode === 'activity') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.pageContent} showsVerticalScrollIndicator={false}>
          <BackRow onBack={() => backFrom('activity')} />
          {selectedProject && (
            <View style={styles.breadcrumb}>
              <View style={[styles.listDot, { backgroundColor: selectedProject.color }]} />
              <Text style={styles.breadcrumbText}>{selectedProject.name}</Text>
            </View>
          )}
          <Text style={styles.stepHeading}>Select Activity</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.billableRow}>
            <Text style={styles.billableLabel}>Billable</Text>
            <TouchableOpacity
              style={[styles.toggle, isBillable && styles.toggleOn]}
              onPress={() => setIsBillable((v) => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.toggleThumb, isBillable && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No activity types yet.</Text>
          ) : (
            activities.map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.listItem}
                onPress={() => handleSelectActivity(a)}
                activeOpacity={0.8}
              >
                <View style={[styles.listDot, { backgroundColor: a.color }]} />
                <Text style={styles.listItemText}>{a.name}</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.addLineBtn} onPress={openAddActivity} activeOpacity={0.75}>
            <Text style={styles.addLineBtnText}>+ Add new activity type</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Add activity type form
  if (mode === 'add-activity') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
            <BackRow onBack={() => backFrom('add-activity')} />
            <Text style={styles.stepHeading}>New Activity Type</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.formLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Development, Meeting…"
              placeholderTextColor="#4a6d80"
              value={formName}
              onChangeText={setFormName}
              autoFocus
            />
            <Text style={styles.formLabel}>Color</Text>
            <View style={styles.colorRow}>
              {PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, formColor === c && styles.colorSelected]}
                  onPress={() => setFormColor(c)}
                />
              ))}
            </View>
            <TouchableOpacity
              style={[styles.primaryBtn, (!formName.trim() || loading) && styles.primaryBtnDisabled]}
              onPress={handleAddActivity}
              disabled={!formName.trim() || loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Create Activity Type</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Objective checklist step
  if (mode === 'objective' && selectedProject && selectedActivity) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView style={{ flex: 1, paddingBottom: 32 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.objScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <BackRow onBack={() => backFrom('objective')} />

            <View style={styles.breadcrumb}>
              <View style={[styles.listDot, { backgroundColor: selectedProject.color }]} />
              <Text style={styles.breadcrumbText}>{selectedProject.name}</Text>
              <Text style={styles.breadcrumbSep}>·</Text>
              <View style={[styles.listDot, { backgroundColor: selectedActivity.color }]} />
              <Text style={styles.breadcrumbText}>{selectedActivity.name}</Text>
            </View>

            <Text style={styles.stepHeading}>Session Objectives</Text>
            <Text style={styles.objSub}>What do you plan to accomplish? (optional)</Text>

            <View style={styles.objInputRow}>
              <TextInput
                style={styles.objInput}
                placeholder="Add a task…"
                placeholderTextColor="#4a6d80"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={addItem}
                returnKeyType="done"
                blurOnSubmit={true}
              />
              <TouchableOpacity
                style={[styles.addItemBtn, !inputText.trim() && styles.addItemBtnDisabled]}
                onPress={addItem}
                activeOpacity={0.75}
                disabled={!inputText.trim()}
              >
                <Text style={styles.addItemBtnText}>Add</Text>
              </TouchableOpacity>
            </View>

            {items.map((item, index) => (
              <View key={index} style={styles.objItem}>
                <View style={styles.objBullet} />
                <Text style={styles.objItemText} numberOfLines={2}>{item}</Text>
                <TouchableOpacity onPress={() => removeItem(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.objRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.objActions}>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleStart} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Start Session</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkipObjectives} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip objectives</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return null;
}

// ── Back row helper ────────────────────────────────────────────────────────────

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backRow}>
      <Text style={styles.backText}>← Back</Text>
    </TouchableOpacity>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  pageContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 48,
  },

  // Back row
  backRow: {
    marginBottom: 20,
  },
  backText: {
    fontSize: 14,
    color: '#7aa3b8',
    fontWeight: '600',
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  breadcrumbText: {
    fontSize: 13,
    color: '#7aa3b8',
    fontWeight: '600',
  },
  breadcrumbSep: {
    color: '#4a6d80',
    fontSize: 13,
  },

  // Headings
  sectionLabel: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 14,
  },
  stepHeading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 20,
  },

  // Combo cards
  comboCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  comboLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  comboDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  comboTextGroup: {
    flex: 1,
    gap: 3,
  },
  comboProject: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  comboMeta: {
    fontSize: 12,
    color: '#7aa3b8',
  },
  activityChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  activityChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  emptyCard: {
    backgroundColor: '#233d4d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2d4f62',
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  emptyText: {
    color: '#7aa3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubText: {
    color: '#4a6d80',
    fontSize: 13,
  },

  newSessionBtn: {
    marginTop: 4,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fe7f2d',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  newSessionText: {
    color: '#fe7f2d',
    fontSize: 15,
    fontWeight: '600',
  },

  // List items (client, project, activity)
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#233d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 10,
  },
  listDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  internalBadge: {
    fontSize: 11,
    color: '#7aa3b8',
    backgroundColor: '#2d4f62',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    fontWeight: '600',
  },
  editBtn: {
    paddingLeft: 8,
  },
  editBtnText: {
    fontSize: 13,
    color: '#7aa3b8',
    fontWeight: '600',
  },

  addLineBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2d4f62',
    borderStyle: 'dashed',
    alignItems: 'center',
    marginTop: 4,
  },
  addLineBtnText: {
    color: '#7aa3b8',
    fontSize: 14,
    fontWeight: '600',
  },

  // Billable toggle
  billableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#233d4d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2d4f62',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  billableLabel: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '600',
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#2d4f62',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  toggleOn: {
    backgroundColor: '#4ade80',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  // Objective step
  objScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  objSub: {
    fontSize: 14,
    color: '#7aa3b8',
    marginBottom: 20,
    marginTop: -12,
  },
  objInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  objInput: {
    flex: 1,
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#ffffff',
  },
  addItemBtn: {
    backgroundColor: '#fe7f2d',
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtnDisabled: {
    opacity: 0.35,
  },
  addItemBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  objItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#233d4d',
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  objBullet: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#fe7f2d',
    flexShrink: 0,
  },
  objItemText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  objRemove: {
    fontSize: 20,
    color: '#4a6d80',
    lineHeight: 22,
    flexShrink: 0,
  },
  objActions: {
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  skipText: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 8,
  },

  // Forms
  formLabel: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#2d4f62',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    color: '#ffffff',
    backgroundColor: '#233d4d',
  },
  inputMulti: {
    height: 90,
    textAlignVertical: 'top',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  colorDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#ffffff',
  },

  // Primary button
  primaryBtn: {
    backgroundColor: '#fe7f2d',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Error
  error: {
    backgroundColor: '#EF444420',
    color: '#EF4444',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EF444440',
  },
});
