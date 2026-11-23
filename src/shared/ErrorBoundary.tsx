import { Component, type ErrorInfo, type ReactNode } from 'react';
import { exportAll } from './db';
import { Btn, Card } from './ui';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Ошибка рендера:', error, info.componentStack);
  }

  async download(): Promise<void> {
    try {
      const data = await exportAll();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'monk-backup.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Не удалось выгрузить данные');
    }
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="app">
        <div className="screen">
          <div className="top">
            <div>
              <div className="top-date">Сбой</div>
              <h1 className="h1">Что-то сломалось</h1>
            </div>
          </div>

          <Card>
            <p className="small" style={{ marginTop: 0, lineHeight: 1.55 }}>
              Данные целы — они хранятся отдельно от экрана. Сначала забери бэкап, потом перезагрузи.
            </p>
            <div className="input-row">
              <Btn variant="secondary" onClick={() => void this.download()}>
                Скачать данные
              </Btn>
              <Btn onClick={() => window.location.reload()}>Перезагрузить</Btn>
            </div>
          </Card>

          <Card>
            <div className="label">Текст ошибки</div>
            <p className="small muted" style={{ marginBottom: 0, wordBreak: 'break-word' }}>
              {this.state.error.message}
            </p>
          </Card>
        </div>
      </div>
    );
  }
}
