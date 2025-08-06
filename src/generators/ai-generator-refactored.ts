interface ComponentSpec {
  type: string;
  props: Record<string, any>;
}

interface ScreenSpec {
  name: string;
  components: ComponentSpec[];
}

interface AppSpec {
  appName: string;
  screens: ScreenSpec[];
  dataCollection?: string;
  enableDatabase?: boolean;
}

interface Template {
  name: string;
  keywords: string[];
  generate: () => AppSpec;
}

export class AIAppGenerator {
  // Templates defined as simple objects with generation functions
  private templates: Template[] = [
    {
      name: 'Todo List App',
      keywords: ['todo', 'task', 'list', 'checklist'],
      generate: () => ({
        appName: 'Todo List App',
        dataCollection: 'todos',
        enableDatabase: true,
        screens: [{
          name: 'MainScreen',
          components: [
            {
              type: 'Header',
              props: { title: 'My Tasks' }
            },
            {
              type: 'DataForm',
              props: { 
                collection: 'todos',
                fields: [
                  { name: 'title', label: 'Task', placeholder: 'Enter task...' },
                  { name: 'description', label: 'Description', type: 'multiline', placeholder: 'Task details...' }
                ],
                submitLabel: 'Add Task'
              }
            },
            {
              type: 'DataList',
              props: {
                collection: 'todos',
                onDelete: true
              }
            }
          ]
        }]
      })
    },
    {
      name: 'Dashboard App',
      keywords: ['dashboard', 'analytics', 'metrics', 'charts'],
      generate: () => ({
        appName: 'Dashboard App',
        screens: [{
          name: 'DashboardScreen',
          components: [
            {
              type: 'Header',
              props: { title: 'Analytics Dashboard' }
            },
            {
              type: 'Card',
              props: {
                title: 'Total Users',
                content: '1,234 active users this month'
              }
            },
            {
              type: 'Card',
              props: {
                title: 'Revenue',
                content: '$45,678 this quarter'
              }
            },
            {
              type: 'List',
              props: {
                items: [
                  { title: 'Recent Activity 1' },
                  { title: 'Recent Activity 2' },
                  { title: 'Recent Activity 3' }
                ]
              }
            }
          ]
        }]
      })
    },
    {
      name: 'Blog App',
      keywords: ['blog', 'article', 'post', 'content', 'writing'],
      generate: () => ({
        appName: 'Blog App',
        dataCollection: 'posts',
        enableDatabase: true,
        screens: [{
          name: 'BlogScreen',
          components: [
            {
              type: 'Header',
              props: { title: 'My Blog' }
            },
            {
              type: 'DataForm',
              props: {
                collection: 'posts',
                fields: [
                  { name: 'title', label: 'Title', placeholder: 'Post title...' },
                  { name: 'content', label: 'Content', type: 'multiline', placeholder: 'Write your post...' }
                ],
                submitLabel: 'Publish Post'
              }
            },
            {
              type: 'DataList',
              props: {
                collection: 'posts',
                onDelete: true
              }
            }
          ]
        }]
      })
    }
  ];

  async generateApp(userPrompt: string): Promise<AppSpec> {
    const template = this.findTemplate(userPrompt);
    
    if (template) {
      return template.generate();
    }
    
    // Default fallback for unmatched prompts
    return this.generateDefaultApp(userPrompt);
  }

  private findTemplate(prompt: string): Template | undefined {
    const lowerPrompt = prompt.toLowerCase();
    
    // Find the first template that matches any keyword
    return this.templates.find(template => 
      template.keywords.some(keyword => lowerPrompt.includes(keyword))
    );
  }

  private generateDefaultApp(prompt: string): AppSpec {
    return {
      appName: 'Generated App',
      screens: [{
        name: 'MainScreen',
        components: [
          {
            type: 'Header',
            props: { title: prompt.slice(0, 20) }
          },
          {
            type: 'Card',
            props: {
              title: 'Welcome',
              content: `App generated from: "${prompt}"`
            }
          },
          {
            type: 'Button',
            props: { label: 'Get Started' }
          }
        ]
      }]
    };
  }
}