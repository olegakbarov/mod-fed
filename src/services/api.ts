const API_BASE_URL = 'http://localhost:3002';

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

class ApiService {
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error) {
      console.error('API request failed:', error);
      return { error: 'Network error' };
    }
  }

  // App management
  async getApps() {
    return this.request('/api/apps');
  }

  async createApp(name: string, spec: any) {
    return this.request('/api/apps', {
      method: 'POST',
      body: JSON.stringify({ name, spec }),
    });
  }

  async getApp(id: number) {
    return this.request(`/api/apps/${id}`);
  }

  async deleteApp(id: number) {
    return this.request(`/api/apps/${id}`, { method: 'DELETE' });
  }

  // Dynamic data operations
  async getData(collection: string) {
    return this.request(`/api/data/${collection}`);
  }

  async createData(collection: string, data: any) {
    return this.request(`/api/data/${collection}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateData(collection: string, id: number, data: any) {
    return this.request(`/api/data/${collection}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteData(collection: string, id: number) {
    return this.request(`/api/data/${collection}/${id}`, {
      method: 'DELETE',
    });
  }

  async getStats() {
    return this.request('/api/stats');
  }
}

export const apiService = new ApiService();