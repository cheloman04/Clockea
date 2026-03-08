import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Project } from '../database/types';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onEdit: (project: Project) => void;
}

export default function ProjectCard({ project, onSelect, onEdit }: ProjectCardProps) {
  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => onSelect(project)}
        activeOpacity={0.75}
      >
        <View style={[styles.accent, { backgroundColor: project.color }]} />
        <View style={styles.content}>
          <Text style={styles.name}>{project.name}</Text>
          {project.description ? (
            <Text style={styles.description} numberOfLines={1}>
              {project.description}
            </Text>
          ) : (
            <Text style={styles.hint}>Tap to start tracking</Text>
          )}
        </View>
        <View style={[styles.colorDot, { backgroundColor: project.color }]} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.editBtn}
        onPress={() => onEdit(project)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.editIcon}>✎</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 5,
    marginHorizontal: 20,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#233d4d',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d4f62',
  },
  accent: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 3,
  },
  description: {
    fontSize: 12,
    color: '#fe7f2d',
  },
  hint: {
    fontSize: 12,
    color: '#7aa3b8',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 18,
  },
  editBtn: {
    paddingLeft: 14,
    paddingRight: 4,
  },
  editIcon: {
    fontSize: 20,
    color: '#7aa3b8',
  },
});
