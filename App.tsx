import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar as RNStatusBar,
  ScrollView,
  Alert,
  Dimensions
} from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

import { Conversion, ConversionType } from './types';
import { conversionTypes, getMockOutputName, getMockSizeReduction } from './lib/conversions';
import { storage } from './lib/storage';

import ConversionCard from './components/ConversionCard';
import HistoryItem from './components/HistoryItem';
import ProgressModal from './components/ProgressModal';
import SuccessModal from './components/SuccessModal';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

function HomeScreen({ navigation }: any) {
  const [history, setHistory] = useState<Conversion[]>([]);
  const [selectedType, setSelectedType] = useState<ConversionType | null>(null);
  const [isProgressVisible, setIsProgressVisible] = useState(false);
  const [isSuccessVisible, setIsSuccessVisible] = useState(false);
  const [currentConversion, setCurrentConversion] = useState<any>(null);
  const [currentFile, setCurrentFile] = useState<any>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const saved = await storage.getHistory();
    setHistory(saved);
  };

  const handleSelectConversion = async (type: ConversionType) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: type.from.includes('PDF') ? ['application/pdf'] : 
              type.from.includes('Image') ? ['image/*'] : 
              ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) return;

      const pickedFile = result.assets[0];
      setCurrentFile(pickedFile);
      setSelectedType(type);

      // Show progress modal
      setIsProgressVisible(true);
      setCurrentConversion({
        type,
        fileName: pickedFile.name,
        outputName: getMockOutputName(type.id, pickedFile.name),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleConversionComplete = async () => {
    setIsProgressVisible(false);
    
    if (!selectedType || !currentFile) return;

    const originalSizeKB = Math.floor((currentFile.size || 245000) / 1024);
    const convertedSize = getMockSizeReduction(selectedType.id, originalSizeKB);

    const newConversion: Conversion = {
      id: Date.now().toString(),
      fromType: selectedType.from,
      toType: selectedType.to,
      fileName: currentFile.name,
      outputName: getMockOutputName(selectedType.id, currentFile.name),
      originalSize: `${originalSizeKB} KB`,
      convertedSize: convertedSize,
      date: new Date().toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit' 
      }),
      status: 'completed',
      conversionType: selectedType.title,
    };

    await storage.addConversion(newConversion);
    await loadHistory();

    setCurrentConversion(newConversion);
    setIsSuccessVisible(true);
  };

  const handleShare = async () => {
    if (!currentConversion) return;
    
    try {
      // Simulate file for sharing
      const fakeUri = `${FileSystem.cacheDirectory}converted_${Date.now()}.pdf`;
      await FileSystem.writeAsStringAsync(fakeUri, 'This is a demo converted file content', { encoding: FileSystem.EncodingType.UTF8 });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fakeUri, { 
          mimeType: currentConversion.toType.includes('PDF') ? 'application/pdf' : 'application/zip',
          dialogTitle: `Share ${currentConversion.outputName}`
        });
      } else {
        Alert.alert('Success', 'File would be shared in real app');
      }
    } catch (e) {
      Alert.alert('Shared', `Your converted file ${currentConversion.outputName} has been shared!`);
    }
  };

  const handleDownload = () => {
    Alert.alert(
      "Downloaded", 
      `Your file has been saved as:\n\n${currentConversion?.outputName}\n\n(In a real app this would save to device storage)`
    );
    setIsSuccessVisible(false);
  };

  const handleHistoryPress = (item: Conversion) => {
    Alert.alert(
      item.fileName,
      `${item.conversionType}\n\nSize: ${item.originalSize} → ${item.convertedSize || item.originalSize}\nDate: ${item.date}`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PDF Forge</Text>
        <Text style={styles.headerSubtitle}>Convert • Compress • Transform</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Popular Conversions</Text>
          <FlatList
            data={conversionTypes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ConversionCard item={item} onPress={handleSelectConversion} />
            )}
            scrollEnabled={false}
            contentContainerStyle={styles.listContent}
          />
        </View>

        {history.length > 0 && (
          <View style={styles.section}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <TouchableOpacity onPress={() => {
                Alert.alert('Clear History?', 'This will delete all conversion records.', [
                  { text: 'Cancel' },
                  { text: 'Clear', style: 'destructive', onPress: async () => {
                    await storage.clearHistory();
                    setHistory([]);
                  }}
                ]);
              }}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            </View>
            
            {history.slice(0, 3).map((item) => (
              <HistoryItem 
                key={item.id} 
                item={item} 
                onPress={handleHistoryPress} 
              />
            ))}
          </View>
        )}

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={22} color="#64748B" />
          <Text style={styles.infoText}>
            This demo simulates real PDF conversions using Expo Document Picker and mock processing. 
            All files stay on your device.
          </Text>
        </View>
      </ScrollView>

      <ProgressModal
        visible={isProgressVisible}
        onClose={() => setIsProgressVisible(false)}
        conversionType={currentConversion?.type.title || ''}
        fileName={currentConversion?.fileName || ''}
        onComplete={handleConversionComplete}
      />

      <SuccessModal
        visible={isSuccessVisible}
        onClose={() => setIsSuccessVisible(false)}
        outputName={currentConversion?.outputName || ''}
        conversionType={currentConversion?.conversionType || ''}
        onShare={handleShare}
        onDownload={handleDownload}
      />
    </SafeAreaView>
  );
}

function HistoryScreen() {
  const [history, setHistory] = useState<Conversion[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const saved = await storage.getHistory();
    setHistory(saved);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const clearAll = () => {
    Alert.alert('Clear All History?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear All', 
        style: 'destructive', 
        onPress: async () => {
          await storage.clearHistory();
          setHistory([]);
        }
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Conversion History</Text>
        <Text style={styles.headerSubtitle}>All your past conversions</Text>
      </View>

      {history.length > 0 ? (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <HistoryItem 
              item={item} 
              onPress={() => {
                Alert.alert(
                  'Conversion Details',
                  `${item.fileName}\n\nFrom: ${item.fromType}\nTo: ${item.toType}\nSize: ${item.originalSize}${item.convertedSize ? ` → ${item.convertedSize}` : ''}\n\nDate: ${item.date}`,
                  [{ text: 'Close' }]
                );
              }} 
            />
          )}
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.historyList}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={68} color="#334155" />
          <Text style={styles.emptyTitle}>No conversions yet</Text>
          <Text style={styles.emptySubtitle}>Your conversion history will appear here</Text>
          <TouchableOpacity 
            style={styles.emptyButton}
            onPress={() => {/* Switch to home tab */}}
          >
            <Text style={styles.emptyButtonText}>Start Converting</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.length > 0 && (
        <TouchableOpacity style={styles.clearAllButton} onPress={clearAll}>
          <Ionicons name="trash-outline" size={18} color="#F87171" />
          <Text style={styles.clearAllText}>Clear All History</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

function ToolsScreen() {
  const tools = [
    {
      id: '1',
      title: 'Merge PDFs',
      icon: 'git-merge',
      color: '#22C55E',
      desc: 'Combine multiple PDFs into one document'
    },
    {
      id: '2',
      title: 'Split PDF',
      icon: 'cut',
      color: '#F97316',
      desc: 'Split PDF into separate pages or ranges'
    },
    {
      id: '3',
      title: 'Rotate PDF',
      icon: 'refresh',
      color: '#06B6D4',
      desc: 'Rotate pages inside your PDF'
    },
    {
      id: '4',
      title: 'Add Watermark',
      icon: 'water',
      color: '#A855F7',
      desc: 'Protect your documents with watermarks'
    },
  ];

  const handleToolPress = (tool: any) => {
    Alert.alert(
      tool.title,
      `${tool.desc}\n\nThis feature would be fully implemented in a production version of PDF Forge.`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More Tools</Text>
        <Text style={styles.headerSubtitle}>Advanced PDF utilities</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.toolsContainer}>
        {tools.map((tool) => (
          <TouchableOpacity 
            key={tool.id}
            style={styles.toolCard}
            onPress={() => handleToolPress(tool)}
          >
            <View style={[styles.toolIconContainer, { backgroundColor: `${tool.color}20` }]}>
              <Ionicons name={tool.icon as any} size={34} color={tool.color} />
            </View>
            <View style={styles.toolInfo}>
              <Text style={styles.toolTitle}>{tool.title}</Text>
              <Text style={styles.toolDesc}>{tool.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#475569" />
          </TouchableOpacity>
        ))}

        <View style={styles.premiumBanner}>
          <View style={styles.premiumContent}>
            <Ionicons name="star" size={26} color="#FACC15" />
            <Text style={styles.premiumTitle}>Unlock Premium</Text>
            <Text style={styles.premiumDesc}>Remove limits • Batch process • OCR extraction</Text>
          </View>
          <TouchableOpacity style={styles.premiumButton}>
            <Text style={styles.premiumButtonText}>Upgrade — $4.99/mo</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footerNote}>
          PDF Forge v1.2.4 • All conversions are processed locally on device
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopWidth: 1,
          borderTopColor: '#1E2937',
          height: 68,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: '#6366F1',
        tabBarInactiveTintColor: '#64748B',
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen 
        name="Convert" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="History" 
        component={HistoryScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="time" size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Tools" 
        component={ToolsScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="construct" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <NavigationContainer>
      <MainTabs />
      <RNStatusBar barStyle="light-content" backgroundColor="#0F172A" />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E2937',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F1F5F9',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  scroll: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: 16,
    marginLeft: 4,
  },
  listContent: {
    paddingBottom: 20,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 4,
    marginBottom: 12,
  },
  clearText: {
    color: '#F87171',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    margin: 20,
    padding: 18,
    backgroundColor: '#1E2937',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#94A3B8',
  },
  historyList: {
    paddingTop: 12,
    paddingBottom: 80,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 24,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 60,
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 32,
    backgroundColor: '#6366F1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  emptyButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
  clearAllButton: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: '#1E2937',
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  clearAllText: {
    color: '#F87171',
    fontWeight: '600',
    fontSize: 15,
  },
  toolsContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  toolCard: {
    backgroundColor: '#1F2937',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toolIconContainer: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  toolInfo: {
    flex: 1,
  },
  toolTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1F5F9',
  },
  toolDesc: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 3,
    lineHeight: 20,
  },
  premiumBanner: {
    marginTop: 28,
    backgroundColor: '#1E2937',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#4F46E5',
  },
  premiumContent: {
    alignItems: 'center',
  },
  premiumTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#E0E7FF',
    marginTop: 12,
  },
  premiumDesc: {
    textAlign: 'center',
    color: '#A5B4FC',
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 8,
  },
  premiumButton: {
    marginTop: 24,
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  premiumButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15.5,
  },
  footerNote: {
    textAlign: 'center',
    color: '#475569',
    fontSize: 12,
    marginTop: 40,
    marginBottom: 30,
  },
});
