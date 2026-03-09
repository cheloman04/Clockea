import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  FlatList,
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
  getProjects,
  updateProject,
} from '../database/storage';
import { Project } from '../database/types';

const PALETTE = ['#fe7f2d', '#e91e63', '#4caf50', '#00bcd4', '#9c27b0', '#ffb300'];

type Mode = 'list' | 'add' | 'edit';

export default function ClockInScreen() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [editingProject, setEditingProject] = useState<Project | null>(null);

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

  async function handleSelectProject(project: Project) {
    await clockIn(project.id);
    router.replace('/working');
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {!showForm ? (
        <>
          <Text style={styles.heading}>Select a Project</Text>
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
