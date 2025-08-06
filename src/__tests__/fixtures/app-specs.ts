import { AppSpec, ComponentSpec, ScreenSpec } from '../../generators/ai-generator';

// Sample component specifications
export const sampleComponents: Record<string, ComponentSpec> = {
  header: {
    type: 'Header',
    props: { title: 'Sample Header', showBack: false },
  },
  
  headerWithBack: {
    type: 'Header',
    props: { title: 'Detail View', showBack: true },
  },
  
  button: {
    type: 'Button',
    props: { label: 'Click Me', onPress: 'handlePress' },
  },
  
  textInput: {
    type: 'TextInput',
    props: { 
      placeholder: 'Enter text...', 
      value: '', 
      onChangeText: 'handleTextChange' 
    },
  },
  
  card: {
    type: 'Card',
    props: {
      title: 'Sample Card',
      content: 'This is a sample card component with some content.',
      image: 'https://example.com/image.png',
    },
  },
  
  list: {
    type: 'List',
    props: {
      items: [
        { title: 'Item 1', subtitle: 'First item' },
        { title: 'Item 2', subtitle: 'Second item' },
        { title: 'Item 3', subtitle: 'Third item' },
      ],
    },
  },
  
  dataForm: {
    type: 'DataForm',
    props: {
      collection: 'todos',
      fields: [
        { name: 'title', label: 'Task', placeholder: 'Enter task...', type: 'text' },
        { name: 'description', label: 'Description', placeholder: 'Task details...', type: 'multiline' },
        { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'] },
      ],
      submitLabel: 'Add Task',
    },
  },
  
  dataList: {
    type: 'DataList',
    props: {
      collection: 'todos',
      onDelete: true,
      displayFields: ['title', 'priority'],
    },
  },
};

// Sample screen specifications
export const sampleScreens: Record<string, ScreenSpec> = {
  mainScreen: {
    name: 'MainScreen',
    components: [
      sampleComponents.header,
      sampleComponents.card,
      sampleComponents.button,
    ],
  },
  
  todoScreen: {
    name: 'TodoScreen',
    components: [
      sampleComponents.header,
      sampleComponents.dataForm,
      sampleComponents.dataList,
    ],
  },
  
  formScreen: {
    name: 'FormScreen',
    components: [
      sampleComponents.headerWithBack,
      sampleComponents.textInput,
      sampleComponents.button,
    ],
  },
  
  listScreen: {
    name: 'ListScreen',
    components: [
      sampleComponents.header,
      sampleComponents.list,
    ],
  },
  
  dashboardScreen: {
    name: 'DashboardScreen',
    components: [
      sampleComponents.header,
      {
        type: 'Card',
        props: { title: 'Total Users', content: '1,234 active users' },
      },
      {
        type: 'Card',
        props: { title: 'Revenue', content: '$45,678 this quarter' },
      },
      sampleComponents.list,
    ],
  },
};

// Sample app specifications
export const sampleAppSpecs: Record<string, AppSpec> = {
  todoApp: {
    appName: 'Todo List App',
    dataCollection: 'todos',
    enableDatabase: true,
    screens: [sampleScreens.todoScreen],
  },
  
  simpleApp: {
    appName: 'Simple App',
    screens: [sampleScreens.mainScreen],
  },
  
  multiScreenApp: {
    appName: 'Multi-Screen App',
    screens: [
      sampleScreens.mainScreen,
      sampleScreens.formScreen,
      sampleScreens.listScreen,
    ],
  },
  
  dashboardApp: {
    appName: 'Dashboard App',
    screens: [sampleScreens.dashboardScreen],
  },
  
  blogApp: {
    appName: 'Blog App',
    dataCollection: 'posts',
    enableDatabase: true,
    screens: [{
      name: 'BlogScreen',
      components: [
        sampleComponents.header,
        {
          type: 'DataForm',
          props: {
            collection: 'posts',
            fields: [
              { name: 'title', label: 'Title', placeholder: 'Post title...', type: 'text' },
              { name: 'content', label: 'Content', placeholder: 'Write your post...', type: 'multiline' },
              { name: 'tags', label: 'Tags', placeholder: 'comma, separated, tags', type: 'text' },
            ],
            submitLabel: 'Publish Post',
          },
        },
        {
          type: 'DataList',
          props: {
            collection: 'posts',
            onDelete: true,
            displayFields: ['title', 'tags'],
          },
        },
      ],
    }],
  },
  
  complexApp: {
    appName: 'Complex Multi-Feature App',
    dataCollection: 'items',
    enableDatabase: true,
    screens: [
      {
        name: 'HomeScreen',
        components: [
          { type: 'Header', props: { title: 'Home' } },
          { type: 'Card', props: { title: 'Welcome', content: 'Welcome to the app!' } },
          { type: 'Button', props: { label: 'Get Started' } },
        ],
      },
      {
        name: 'ListScreen',
        components: [
          { type: 'Header', props: { title: 'Items', showBack: true } },
          { type: 'DataList', props: { collection: 'items', onDelete: true } },
        ],
      },
      {
        name: 'FormScreen',
        components: [
          { type: 'Header', props: { title: 'Add Item', showBack: true } },
          {
            type: 'DataForm',
            props: {
              collection: 'items',
              fields: [
                { name: 'name', label: 'Name', placeholder: 'Item name...', type: 'text' },
                { name: 'category', label: 'Category', type: 'select', options: ['Work', 'Personal', 'Other'] },
                { name: 'description', label: 'Description', placeholder: 'Describe the item...', type: 'multiline' },
              ],
              submitLabel: 'Add Item',
            },
          },
        ],
      },
    ],
  },
  
  // Edge cases and invalid specs for testing
  emptyApp: {
    appName: 'Empty App',
    screens: [],
  },
  
  appWithEmptyScreen: {
    appName: 'App with Empty Screen',
    screens: [{
      name: 'EmptyScreen',
      components: [],
    }],
  },
  
  appWithInvalidComponent: {
    appName: 'App with Invalid Component',
    screens: [{
      name: 'InvalidScreen',
      components: [{
        type: 'NonExistentComponent',
        props: { invalid: 'properties' },
      }],
    }],
  },
};