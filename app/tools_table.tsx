import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { StyleSheet, View, Text, TextInput, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { listTools, subscribeTools } from '../src/db/toolsRepo';
import { getBoolSetting, getStringSetting } from '../src/db/settings';
import { colors, font, radius, spacing } from '../src/theme';
import type { Tool } from '../src/types';

export default function ToolsTableScreen() {
  const router = useRouter();
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Settings
  const [showCategory, setShowCategory] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'quantity'>('name');

  const loadSettings = useCallback(async () => {
    const sc = await getBoolSetting('show_category_column', true);
    setShowCategory(sc);
    const ds = await getStringSetting('default_sort', 'name');
    setSortBy(ds === 'quantity' ? 'quantity' : 'name');
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeTools((updatedTools) => {
      setTools(updatedTools);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let res = tools;
    if (q) {
      res = res.filter(t =>
        t.name.toLowerCase().includes(q) ||
        (t.location && t.location.toLowerCase().includes(q)) ||
        (t.serial_number && t.serial_number.toLowerCase().includes(q))
      );
    }
    return [...res].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return b.available_qty - a.available_qty;
    });
  }, [tools, search, sortBy]);

  const renderTool = ({ item }: { item: Tool }) => (
    <TouchableOpacity 
      style={styles.row}
      onPress={() => router.push(`/tool/${item.id}` as any)}
      activeOpacity={0.7}
    >
      <Text style={[styles.cell, { flex: 2 }]} numberOfLines={1}>{item.name}</Text>
      <Text style={[styles.cell, { flex: 1, textAlign: 'center', fontWeight: '700', color: item.available_qty <= item.min_quantity ? colors.danger : colors.text }]}>{item.available_qty}/{item.total_quantity}</Text>
      <Text style={[styles.cell, { flex: 1.5 }]} numberOfLines={1}>{item.location ?? '-'}</Text>
      {showCategory && (
        <Text style={[styles.cell, { flex: 1, color: (item as any).category_color || '#6B7280' }]} numberOfLines={1}>
          {(item as any).category_name || '-'}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchBar}
            placeholder="بحث عن أداة..."
            placeholderTextColor={colors.textLight}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textLight} />
            </Pressable>
          )}
        </View>
        <View style={styles.sortRow}>
          <Text style={styles.sortLabel}>فرز:</Text>
          <Pressable onPress={() => setSortBy('name')} style={[styles.sortChip, sortBy==='name' && styles.sortChipActive]}>
            <Text style={[styles.sortChipText, sortBy==='name' && styles.sortChipTextActive]}>الاسم</Text>
          </Pressable>
          <Pressable onPress={() => setSortBy('quantity')} style={[styles.sortChip, sortBy==='quantity' && styles.sortChipActive]}>
            <Text style={[styles.sortChipText, sortBy==='quantity' && styles.sortChipTextActive]}>الكمية</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { flex: 2 }]}>الصنف</Text>
        <Text style={[styles.headerCell, { flex: 1, textAlign: 'center' }]}>متاح/كلي</Text>
        <Text style={[styles.headerCell, { flex: 1.5 }]}>الموقع</Text>
        {showCategory && <Text style={[styles.headerCell, { flex: 1 }]}>التصنيف</Text>}
      </View>
      
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderTool}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>لا توجد أدوات</Text>}
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push('/tool/new' as any)}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9', padding: 10 },
  topBar: { gap: 8, marginBottom: 10 },
  searchWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: 'white', paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#ddd' },
  searchBar: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text, textAlign: 'right' },
  sortRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  sortLabel: { fontSize: 12, color: colors.textMuted },
  sortChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd' },
  sortChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  sortChipText: { fontSize: 12, color: colors.textMuted },
  sortChipTextActive: { color: 'white' },
  headerRow: { flexDirection: 'row-reverse', padding: 10, backgroundColor: '#eee', borderRadius: 8, marginBottom: 5 },
  headerCell: { fontWeight: 'bold', fontSize: 13, color: colors.text },
  row: { flexDirection: 'row-reverse', padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  cell: { fontSize: 13, color: colors.text, textAlign: 'right' },
  listContent: { paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, color: colors.textMuted },
  fab: { position: 'absolute', bottom: 20, right: 20, backgroundColor: colors.primary, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 5 }
});
