export interface ComponentProp {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'function' | 'any';
  required?: boolean;
  default?: any;
  description?: string;
  validator?: (value: any) => boolean;
}

export interface ComponentSchema {
  id: string;
  name: string;
  version: string;
  type: string;
  category: 'display' | 'input' | 'layout' | 'navigation' | 'data' | 'utility';
  description: string;
  aiTags: string[];
  props: ComponentProp[];
  dependencies?: string[];
  capabilities?: string[];
  compatibility?: {
    minReactNativeVersion?: string;
    platforms?: ('ios' | 'android' | 'web')[];
  };
  variants?: {
    [key: string]: Partial<ComponentSchema>;
  };
}

export class ComponentValidator {
  static validateProps(schema: ComponentSchema, props: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check required props
    for (const schemaProp of schema.props) {
      if (schemaProp.required && !(schemaProp.name in props)) {
        errors.push(`Missing required prop: ${schemaProp.name}`);
      }
      
      // Validate prop types
      if (schemaProp.name in props) {
        const value = props[schemaProp.name];
        if (!this.validateType(value, schemaProp.type)) {
          errors.push(`Invalid type for prop ${schemaProp.name}: expected ${schemaProp.type}`);
        }
        
        // Custom validator
        if (schemaProp.validator && !schemaProp.validator(value)) {
          errors.push(`Validation failed for prop ${schemaProp.name}`);
        }
      }
    }
    
    // Check for unknown props
    const knownProps = new Set(schema.props.map(p => p.name));
    for (const propName in props) {
      if (!knownProps.has(propName)) {
        errors.push(`Unknown prop: ${propName}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      case 'function':
        return typeof value === 'function';
      case 'any':
        return true;
      default:
        return false;
    }
  }
  
  static mergeWithVariant(
    baseSchema: ComponentSchema, 
    variantName: string
  ): ComponentSchema | null {
    if (!baseSchema.variants || !baseSchema.variants[variantName]) {
      return null;
    }
    
    const variant = baseSchema.variants[variantName];
    return {
      ...baseSchema,
      ...variant,
      props: variant.props ? variant.props : baseSchema.props,
      aiTags: variant.aiTags ? 
        [...new Set([...baseSchema.aiTags, ...variant.aiTags])] : 
        baseSchema.aiTags
    };
  }
}

// Component schema registry
export const componentSchemas: ComponentSchema[] = [
  {
    id: 'header-basic',
    name: 'Header',
    version: '1.0.0',
    type: 'Header',
    category: 'navigation',
    description: 'Basic header with optional back button',
    aiTags: ['navigation', 'top', 'header', 'title'],
    props: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'The title text to display'
      },
      {
        name: 'showBack',
        type: 'boolean',
        required: false,
        default: false,
        description: 'Whether to show a back button'
      }
    ],
    capabilities: ['navigation'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    }
  },
  {
    id: 'button-primary',
    name: 'Button',
    version: '1.0.0',
    type: 'Button',
    category: 'input',
    description: 'Primary action button',
    aiTags: ['action', 'cta', 'interactive', 'button', 'click'],
    props: [
      {
        name: 'label',
        type: 'string',
        required: true,
        description: 'Button label text'
      },
      {
        name: 'onPress',
        type: 'function',
        required: false,
        description: 'Callback when button is pressed'
      },
      {
        name: 'disabled',
        type: 'boolean',
        required: false,
        default: false,
        description: 'Whether the button is disabled'
      }
    ],
    capabilities: ['interaction'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    },
    variants: {
      'secondary': {
        id: 'button-secondary',
        aiTags: ['action', 'secondary', 'interactive', 'button']
      },
      'danger': {
        id: 'button-danger',
        aiTags: ['action', 'danger', 'delete', 'destructive', 'button']
      }
    }
  },
  {
    id: 'list-simple',
    name: 'List',
    version: '1.0.0',
    type: 'List',
    category: 'display',
    description: 'Simple list for displaying collections',
    aiTags: ['display', 'collection', 'scrollable', 'list', 'items'],
    props: [
      {
        name: 'items',
        type: 'array',
        required: true,
        description: 'Array of items to display'
      },
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Optional list title'
      },
      {
        name: 'renderItem',
        type: 'function',
        required: false,
        description: 'Custom render function for items'
      }
    ],
    capabilities: ['scrolling', 'data-display'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    }
  },
  {
    id: 'card-basic',
    name: 'Card',
    version: '1.0.0',
    type: 'Card',
    category: 'display',
    description: 'Card container for content',
    aiTags: ['container', 'content', 'display', 'card', 'box'],
    props: [
      {
        name: 'title',
        type: 'string',
        required: false,
        description: 'Card title'
      },
      {
        name: 'content',
        type: 'string',
        required: false,
        description: 'Card content text'
      },
      {
        name: 'image',
        type: 'string',
        required: false,
        description: 'Image URL'
      }
    ],
    capabilities: ['content-display'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    }
  },
  {
    id: 'input-basic',
    name: 'TextInput',
    version: '1.0.0',
    type: 'TextInput',
    category: 'input',
    description: 'Text input field',
    aiTags: ['input', 'form', 'interactive', 'text', 'field', 'entry'],
    props: [
      {
        name: 'placeholder',
        type: 'string',
        required: false,
        description: 'Placeholder text'
      },
      {
        name: 'value',
        type: 'string',
        required: false,
        description: 'Input value'
      },
      {
        name: 'onChangeText',
        type: 'function',
        required: false,
        description: 'Callback when text changes'
      },
      {
        name: 'multiline',
        type: 'boolean',
        required: false,
        default: false,
        description: 'Enable multiline input'
      }
    ],
    capabilities: ['text-input'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    },
    variants: {
      'password': {
        id: 'input-password',
        aiTags: ['input', 'password', 'secure', 'field']
      },
      'email': {
        id: 'input-email',
        aiTags: ['input', 'email', 'field']
      }
    }
  },
  {
    id: 'data-form',
    name: 'DataForm',
    version: '1.0.0',
    type: 'DataForm',
    category: 'data',
    description: 'Dynamic form for data collection',
    aiTags: ['form', 'data', 'input', 'collection', 'submit'],
    props: [
      {
        name: 'collection',
        type: 'string',
        required: true,
        description: 'Data collection name'
      },
      {
        name: 'fields',
        type: 'array',
        required: true,
        description: 'Form field definitions'
      },
      {
        name: 'submitLabel',
        type: 'string',
        required: false,
        default: 'Submit',
        description: 'Submit button label'
      },
      {
        name: 'onSubmit',
        type: 'function',
        required: false,
        description: 'Callback on form submission'
      }
    ],
    dependencies: ['TextInput', 'Button'],
    capabilities: ['data-collection', 'validation'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    }
  },
  {
    id: 'data-list',
    name: 'DataList',
    version: '1.0.0',
    type: 'DataList',
    category: 'data',
    description: 'Dynamic list connected to data source',
    aiTags: ['list', 'data', 'display', 'crud', 'collection'],
    props: [
      {
        name: 'collection',
        type: 'string',
        required: true,
        description: 'Data collection name'
      },
      {
        name: 'onDelete',
        type: 'boolean',
        required: false,
        default: false,
        description: 'Enable delete functionality'
      },
      {
        name: 'onEdit',
        type: 'boolean',
        required: false,
        default: false,
        description: 'Enable edit functionality'
      },
      {
        name: 'sortBy',
        type: 'string',
        required: false,
        description: 'Field to sort by'
      },
      {
        name: 'sortOrder',
        type: 'string',
        required: false,
        default: 'asc',
        description: 'Sort order (asc/desc)'
      }
    ],
    dependencies: ['List'],
    capabilities: ['data-display', 'crud-operations'],
    compatibility: {
      platforms: ['ios', 'android', 'web']
    }
  }
];