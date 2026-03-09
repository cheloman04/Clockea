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
import ProjectCard from '../components/ProjectCard';
import {
  clockIn,
  createProject,
  createSessionObjectives,
  getProjects,
  updateProject,
} from '../database/storage';
import { Project } from '../database/types';

const PALETTE = ['#fe7f2d', '#e91e63', '#4caf50', '#00bcd4', '#9c27b0', '#ffb300'];

type Mode = 'list' | 'add' | 'edit' | 'objective';

export default function ClockInScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // objective checklist builder
  const [items, setItems] = useState<string[]>([]);
  const [inputText, setInputText] = useState('');

  // form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(PALETTE[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load projects.');
      });
  }, []);

  function openAdd() {
    setName('');
    setDescription('');
    setSelectedColor(PALETTE[0]);
    setMode('add');
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description ?? '');
    setSelectedColor(project.color);
    setMode('edit');
  }

  function closeForm() {
    setMode('list');
    setEditingProject(null);
  }

  function handleSelectProject(project: Project) {
    setSelectedProject(project);
    setItems([]);
    setInputText('');
    setMode('objective');
  }

  function addItem() {
    const text = inputText.trim();
    if (!text) return;
    setItems((prev) => [...prev, text]);
    setInputText('');
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStart() {
    if (!selectedProject) return;
    try {
      const sessionId = await clockIn(selectedProject.id);
      if (items.length > 0) {
        await createSessionObjectives(sessionId, items);
      }
      router.replace('/working');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session.');
      setMode('list');
    }
  }

  async function handleSkipObjectives() {
    if (!selectedProject) return;
    try {
      await clockIn(selectedProject.id);
      router.replace('/working');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start session.');
      setMode('list');
    }
  }

  async function handleAdd() {
    if (!name.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a project name.');
      return;
    }
    try {
      setError('');
      await createProject(name.trim(), selectedColor);
      setProjects(await getProjects());
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save project.');
    }
  }

  async function handleUpdate() {
    if (!editingProject) return;
    if (!name.trim()) {
      if (Platform.OS === 'web') window.alert('Please enter a project name.');
      return;
    }
    try {
      setError('');
      await updateProject(editingProject.id, name.trim(), selectedColor, description.trim());
      setProjects(await getProjects());
      closeForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update project.');
    }
  }

  const isEditing = mode === 'edit';
  const showForm = mode === 'add' || mode === 'edit';

  // ── Objective checklist builder ──────────────────────────────
  if (mode === 'objective' && selectedProject) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.objOuter}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.objScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.projBadge, { backgroundColor: selectedProject.color + '22' }]}>
              <View style={[styles.projDot, { backgroundColor: selectedProject.color }]} />
              <Text style={[styles.projBadgeText, { color: selectedProject.color }]}>
                {selectedProject.name}
              </Text>
            </View>

            <Text style={styles.objHeading}>Session Objectives</Text>
            <Text style={styles.objSub}>What do you plan to accomplish? (optional)</Text>

            {/* Input row */}
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

            {/* Added items */}
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
            <TouchableOpacity
              style={styles.startBtn}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnText}>Start Session</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSkipObjectives} activeOpacity={0.7}>
              <Text style={styles.skipText}>Skip objectives</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Project list / add / edit ────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!showForm ? (
        <>
          <Text style={styles.heading}>Select a Project</Text>
          {error ? <Text style={[styles.error, { marginHorizontal: 20 }]}>{error}</Text> : null}
          <FlatList
            data={projects}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <ProjectCard
                project={item}
                onSelect={handleSelectProject}
                onEdit={openEdit}
              />
            )}
            contentContainerStyle={styles.list}
            ListFooterComponent={
              <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
                <Text style={styles.addBtnText}>+ New Project</Text>
              </TouchableOpacity>
            }
          />
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.formHeading}>
            {isEditing ? 'Edit Project' : 'New Project'}
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.formLabel}>Project Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Design, Development…"
            placeholderTextColor="#4a6d80"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={styles.formLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            placeholder="What is this project about?"
            placeholderTextColor="#4a6d80"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.formLabel}>Color</Text>
          <View style={styles.colorRow}>
            {PALETTE.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorSelected,
                ]}
                onPress={() => setSelectedColor(c)}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={isEditing ? handleUpdate : handleAdd}
          >
            <Text style={styles.saveBtnText}>
              {isEditing ? 'Save Changes' : 'Save Project'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={closeForm}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e3545',
  },
  heading: {
    fontSize: 11,
    color: '#7aa3b8',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontWeight: '700',
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
  },
  list: {
    paddingBottom: 40,
  },
  addBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 18,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#fe7f2d',
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#fe7f2d',
    fontSize: 15,
    fontWeight: '600',
  },

  // Objective step
  objOuter: {
    flex: 1,
    paddingBottom: 32,
  },
  objScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  projBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    marginBottom: 24,
  },
  projDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  projBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  objHeading: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  objSub: {
    fontSize: 14,
    color: '#7aa3b8',
    marginBottom: 20,
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
  startBtn: {
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
  startBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  skipText: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 8,
  },

  // Project form
  formScroll: {
    padding: 20,
    paddingBottom: 48,
  },
  formHeading: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 28,
  },
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
    marginBottom: 24,
    color: '#ffffff',
    backgroundColor: '#233d4d',
  },
  inputMulti: {
    height: 90,
    textAlignVertical: 'top',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
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
  saveBtn: {
    backgroundColor: '#fe7f2d',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#fe7f2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancel: {
    textAlign: 'center',
    color: '#7aa3b8',
    fontSize: 15,
    paddingVertical: 8,
  },
});
