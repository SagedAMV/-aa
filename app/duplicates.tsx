import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { findDuplicateTools, deleteTool } from '../src/db/toolsRepo';
import { useAuth } from '../src/context/AuthContext';
import { Badge, Card, EmptyState, Loader } from '../src/components/UI';
import { colors, font, radius, spacing } from '../src/theme';
import type { Tool } from '../src/types';

interface DuplicateGroup {
  name: string;
  tools: Tool[];
}

type SelectedMap = Map<string, Set<string>>;

export default function DuplicatesScreen() {
  const { user, isAdmin } = useAuth();
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedMap>(new Map());

  const load = useCallback(async () => {
    try {
      const dupes = await findDuplicateTools();
      const groupsList: DuplicateGroup[] = [];
      dupes.forEach((tools: Tool[], name: string) => {
        groupsList.push({ name, tools });
        // تحديد الأحدث افتراضياً (الاحتفاظ به)
        const latest = tools.reduce((prev: Tool, curr: Tool) =>
          new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev
        );
        setSelected((prev: SelectedMap) => {
          const newMap = new Map(prev);
          const set = new Set<string>(tools.map((t: Tool) => String(t.id)));
          set.delete(String(latest.id));
          newMap.set(name, set);
          return newMap;
        });
      });
      setGroups(groupsList);
    } catch (e) {
      console.error('Failed to load duplicates', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggleSelect = (groupName: string, toolId: string) => {
    const newSelected = new Map(selected);
    const set = new Set<string>(newSelected.get(groupName) ?? new Set<string>());
    if (set.has(toolId)) {
      set.delete(toolId);
    } else {
      set.add(toolId);
    }
    newSelected.set(groupName, set);
    setSelected(newSelected);
  };

  const selectAll = (groupName: string, allIds: string[]) => {
    const newSelected = new Map(selected);
    const currentSet = newSelected.get(groupName) ?? new Set<string>();
    if (currentSet.size === allIds.length - 1) {
      // إلغاء تحديد الكل
      newSelected.set(groupName, new Set<string>());
    } else {
      // تحديد الكل
      newSelected.set(groupName, new Set<string>(allIds));
    }
    setSelected(newSelected);
  };

  const onDeleteGroup = async (group: DuplicateGroup) => {
    const toDelete = selected.get(group.name) ?? new Set<string>();
    if (toDelete.size === 0) {
      Alert.alert('تنبيه', 'لم تحدد أي أداة للحذف');
      return;
    }

    Alert.alert(
      'تأكيد الحذف',
      `هل تريد حذف ${toDelete.size} أداة من "${group.name}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            let success = 0;
            let failed = 0;
            for (const id of Array.from(toDelete)) {
              try {
                await deleteTool(id, user?.username ?? 'admin');
                success++;
              } catch {
                failed++;
              }
            }
            Alert.alert(
              'تم',
              `تم حذف ${success} أداة.${failed > 0 ? `\nفشل حذف ${failed}.` : ''}`,
              [{ text: 'حسناً', onPress: () => load() }]
            );
          },
        },
      ]
    );
  };

  if (!isAdmin) {
    return (
      <View style={s.center}>
        <Ionicons name="lock-closed" size={48} color={colors.textLight} />
        <Text style={s.centerText}>هذه الصفحة متاحة للمدير فقط</Text>
      </View>
    );
  }

  if (loading) return <Loader text="جارٍ البحث عن أدوات متكررة..." />;

  if (groups.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title="لا توجد أدوات متكررة"
        subtitle="جميع أسماء الأدوات فريدة ✅"
      />
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
    >
      <View style={s.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
        <Text style={s.infoText}>
          الأدوات المحددة سيتم حذفها. الأداة غير المحددة هي التي سيتم الاحتفاظ بها.
        </Text>
      </View>

      {groups.map((group) => {
        const toDelete = selected.get(group.name) ?? new Set<string>();
        const allIds = group.tools.map(t => String(t.id));
        return (
          <Card key={group.name} style={s.groupCard}>
            <View style={s.groupHeader}>
              <Text style={s.groupTitle}>
                📌 "{group.name}" — {group.tools.length} نسخ
              </Text>
              <Pressable
                style={s.selectGroupBtn}
                onPress={() => selectAll(group.name, allIds)}
              >
                <Ionicons
                  name={toDelete.size === allIds.length - 1 ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={colors.primary}
                />
                <Text style={s.selectGroupText}>
                  {toDelete.size === allIds.length - 1 ? 'إلغاء' : 'تحديد الكل'}
                </Text>
              </Pressable>
            </View>

            {group.tools.map((tool) => {
              const isMarkedForDelete = toDelete.has(String(tool.id));
              return (
                <Pressable
                  key={String(tool.id)}
                  style={[
                    s.toolRow,
                    isMarkedForDelete && s.toolRowDelete,
                  ]}
                  onPress={() => toggleSelect(group.name, String(tool.id))}
                >
                  <Ionicons
                    name={isMarkedForDelete ? 'trash-outline' : 'checkmark-circle-outline'}
                    size={20}
                    color={isMarkedForDelete ? colors.danger : colors.success}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[
                      s.toolName,
                      isMarkedForDelete && { textDecorationLine: 'line-through', color: colors.danger },
                    ]}>
                      {tool.name}
                    </Text>
                    <View style={s.toolMeta}>
                      {tool.location && (
                        <Text style={s.toolMetaText}>
                          📍 {tool.location}
                        </Text>
                      )}
                      <Text style={s.toolMetaText}>
                        📦 {tool.total_quantity} وحدة
                      </Text>
                      <Text style={s.toolMetaText}>
                        🕐 {tool.created_at?.slice(0, 16) ?? '-'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={[
                s.deleteGroupBtn,
                toDelete.size === 0 && s.deleteGroupBtnDisabled,
              ]}
              onPress={() => onDeleteGroup(group)}
              disabled={toDelete.size === 0}
            >
              <Ionicons name="trash-outline" size={16} color={toDelete.size > 0 ? colors.white : colors.textLight} />
              <Text style={[s.deleteGroupText, toDelete.size === 0 && { color: colors.textLight }]}>
                حذف المحدد ({toDelete.size})
              </Text>
            </Pressable>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.bg, padding: spacing.xl,
  },
  centerText: {
    fontSize: font.h3, color: colors.textMuted,
    textAlign: 'center', marginTop: spacing.md,
  },
  infoCard: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: colors.primaryLight, padding: spacing.md,
    borderRadius: radius.md, marginBottom: spacing.md,
  },
  infoText: { flex: 1, fontSize: font.small, color: colors.primary, textAlign: 'right' },
  groupCard: { padding: spacing.md, marginBottom: spacing.md },
  groupHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: spacing.md,
    paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  groupTitle: { fontSize: font.body, fontWeight: '800', color: colors.text, flex: 1, textAlign: 'right' },
  selectGroupBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  selectGroupText: { fontSize: font.tiny, color: colors.primary, fontWeight: '700' },
  toolRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  toolRowDelete: { backgroundColor: colors.dangerLight + '40', borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  toolName: { fontSize: font.small, fontWeight: '700', color: colors.text, textAlign: 'right' },
  toolMeta: { flexDirection: 'row-reverse', gap: spacing.md, marginTop: 4, flexWrap: 'wrap' },
  toolMetaText: { fontSize: font.tiny, color: colors.textMuted },
  deleteGroupBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: colors.danger, paddingVertical: 10,
    borderRadius: radius.md, marginTop: spacing.md,
  },
  deleteGroupBtnDisabled: { backgroundColor: colors.border },
  deleteGroupText: { fontSize: font.small, fontWeight: '700', color: colors.white },
});
