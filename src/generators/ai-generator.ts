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

export class AIAppGenerator {
  async generateApp(userPrompt: string): Promise<AppSpec> {
    // For PoC, we'll use simple keyword matching
    // In production, this would call Claude/GPT API
    
    const prompt = userPrompt.toLowerCase();
    
    // Simple keyword-based generation
    if (prompt.includes('todo') || prompt.includes('task')) {
      return this.generateTodoApp();
    } else if (prompt.includes('dashboard') || prompt.includes('analytics')) {
      return this.generateDashboardApp();
    } else if (prompt.includes('blog') || prompt.includes('article')) {
      return this.generateBlogApp();
    } else {
      return this.generateDefaultApp(userPrompt);
    }
  }

  private generateTodoApp(): AppSpec {
    return {
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
    };
  }

  private generateDashboardApp(): AppSpec {
    return {
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
    };
  }

  private generateBlogApp(): AppSpec {
    return {
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
    };
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