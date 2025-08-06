import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { apiService } from '../services/api';

interface DataFormProps {
  collection: string;
  fields: Array<{
    name: string;
    label: string;
    type?: 'text' | 'number' | 'multiline';
    placeholder?: string;
  }>;
  onSubmit?: (data: any) => void;
  initialData?: any;
  submitLabel?: string;
}

export default function DataForm({
  collection,
  fields,
  onSubmit,
  initialData = {},
  submitLabel = 'Save',
}: DataFormProps) {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      if (!formData[field.name]?.trim()) {
        newErrors[field.name] = `${field.label} is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    
    try {
      const response = initialData.id
        ? await apiService.updateData(collection, initialData.id, formData)
        : await apiService.createData(collection, formData);

      if (!response.error) {
        onSubmit?.(response.data);
        // Reset form if creating new
        if (!initialData.id) {
          setFormData({});
        }
      }
    } catch (error) {
      console.error('Form submission error:', error);
    }
    
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        {fields.map(field => (
          <View key={field.name} style={styles.fieldContainer}>
            <Text style={styles.label}>{field.label}</Text>
            <TextInput
              style={[
                styles.input,
                field.type === 'multiline' && styles.multilineInput,
                errors[field.name] && styles.inputError,
              ]}
              value={formData[field.name] || ''}
              onChangeText={(text) => handleFieldChange(field.name, text)}
              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              multiline={field.type === 'multiline'}
              numberOfLines={field.type === 'multiline' ? 4 : 1}
              keyboardType={field.type === 'number' ? 'numeric' : 'default'}
            />
            {errors[field.name] && (
              <Text style={styles.errorText}>{errors[field.name]}</Text>
            )}
          </View>
        ))}

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>{submitLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#6200ee',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});