import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { AIAppGenerator } from './src/generators/ai-generator';
import { apiService } from './src/services/api';
import componentRegistry from './src/registry/components-registry.json';

// Import local versions as fallback
import Header from './src/components/Header';
import List from './src/components/List';
import Card from './src/components/Card';
import Button from './src/components/Button';
import TextInputComponent from './src/components/TextInput';
import DataList from './src/components/DataList';
import DataForm from './src/components/DataForm';

const localComponents: Record<string, any> = {
  Header,
  List,
  Card,
  Button,
  TextInput: TextInputComponent,
  DataList,
  DataForm,
};

function App(): JSX.Element {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedApp, setGeneratedApp] = useState<any>(null);
  const [components, setComponents] = useState<any>({});
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    // Check API status
    const checkApi = async () => {
      try {
        const response = await fetch('http://localhost:3002/health');
        const data = await response.json();
        setApiStatus(data.status === 'ok' ? 'online' : 'offline');
      } catch {
        setApiStatus('offline');
      }
    };
    checkApi();
  }, []);
  
  useEffect(() => {
    // Auto-generate todo app for demo
    const demoMode = false; // Set to true to enable auto-generation
    if (demoMode && apiStatus === 'online' && !generatedApp) {
      setPrompt('Create a todo list app');
      setTimeout(() => {
        const demoGenerate = async () => {
          const generator = new AIAppGenerator();
          const appSpec = await generator.generateApp('Create a todo list app');
          
          if (appSpec.enableDatabase) {
            await apiService.createApp(appSpec.appName, appSpec);
          }
          
          const loadedComponents: any = {};
          const screen = appSpec.screens[0];
          
          for (const comp of screen.components) {
            loadedComponents[comp.type] = localComponents[comp.type];
          }
          
          setComponents(loadedComponents);
          setGeneratedApp(appSpec);
          setRefreshTrigger(prev => prev + 1);
        };
        demoGenerate();
      }, 1000);
    }
  }, [apiStatus, generatedApp]);

  const generateApp = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a description for your app');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Generate app specification using AI
      const generator = new AIAppGenerator();
      const appSpec = await generator.generateApp(prompt);
      
      console.log('Generated App Spec:', appSpec);

      // Step 2: Save app to database if it has database enabled
      if (appSpec.enableDatabase && apiStatus === 'online') {
        const response = await apiService.createApp(appSpec.appName, appSpec);
        console.log('App saved to database:', response);
      }

      // Step 3: Load required components
      const loadedComponents: any = {};
      const screen = appSpec.screens[0];
      
      for (const comp of screen.components) {
        const componentName = comp.type;
        if (!loadedComponents[componentName]) {
          // Use local components
          loadedComponents[componentName] = localComponents[componentName];
          if (!loadedComponents[componentName]) {
            console.warn(`Component ${componentName} not found`);
          }
        }
      }
      
      setComponents(loadedComponents);
      setGeneratedApp(appSpec);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error generating app:', error);
      Alert.alert('Error', 'Failed to generate app. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderGeneratedApp = () => {
    if (!generatedApp) return null;
    
    const screen = generatedApp.screens[0];
    
    return (
      <View style={styles.generatedContainer}>
        <Text style={styles.appTitle}>{generatedApp.appName}</Text>
        {generatedApp.enableDatabase && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              💾 Database: {apiStatus === 'online' ? '✅ Connected' : '❌ Offline'}
            </Text>
          </View>
        )}
        <View style={styles.screenContainer}>
          {screen.components.map((comp: any, index: number) => {
            const Component = components[comp.type];
            if (!Component) {
              return (
                <Text key={index} style={styles.errorText}>
                  Component {comp.type} not found
                </Text>
              );
            }
            // Pass refreshTrigger to DataList components
            const props = comp.type === 'DataList' 
              ? { ...comp.props, refreshTrigger }
              : comp.props;
            
            // Handle DataForm onSubmit
            if (comp.type === 'DataForm') {
              props.onSubmit = () => {
                setRefreshTrigger(prev => prev + 1);
              };
            }
            
            return <Component key={index} {...props} />;
          })}
        </View>
      </View>
    );
  };

  const examples = [
    'Create a todo list app',
    'Build a dashboard with analytics',
    'Make a blog reader app',
    'Design a social media feed',
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>AI App Generator</Text>
        <Text style={styles.subtitle}>Describe your app and watch it generate!</Text>
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Describe the app you want to create..."
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />
        <TouchableOpacity
          style={[styles.generateButton, loading && styles.disabledButton]}
          onPress={generateApp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Generate App</Text>
          )}
        </TouchableOpacity>
      </View>

      {!generatedApp && (
        <View style={styles.examplesContainer}>
          <Text style={styles.examplesTitle}>Try these examples:</Text>
          {examples.map((example, index) => (
            <TouchableOpacity
              key={index}
              style={styles.exampleButton}
              onPress={() => setPrompt(example)}
            >
              <Text style={styles.exampleText}>{example}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.loadingText}>Generating your app...</Text>
        </View>
      )}

      {!loading && renderGeneratedApp()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  generateButton: {
    backgroundColor: '#6200ee',
    padding: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  examplesContainer: {
    padding: 16,
  },
  examplesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  exampleButton: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#6200ee',
  },
  exampleText: {
    color: '#6200ee',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  generatedContainer: {
    flex: 1,
    margin: 16,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  errorText: {
    color: 'red',
    padding: 16,
    textAlign: 'center',
  },
  statusBadge: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
});

export default App;