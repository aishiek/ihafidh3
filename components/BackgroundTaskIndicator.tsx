import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { X, AlertCircle, CheckCircle, Clock } from 'lucide-react-native';
import { useBackgroundProcessor } from '@/hooks/useBackgroundProcessor';

interface BackgroundTaskIndicatorProps {
  visible: boolean;
  onClose: () => void;
}

export const BackgroundTaskIndicator: React.FC<BackgroundTaskIndicatorProps> = ({
  visible,
  onClose
}) => {
  const { currentTask, progress, isProcessing, allTasks, cancelCurrentTask } = useBackgroundProcessor();

  if (!visible || !currentTask) return null;

  const getStatusIcon = () => {
    switch (currentTask.status) {
      case 'running':
        return <Clock size={20} color="#FF9800" />;
      case 'completed':
        return <CheckCircle size={20} color="#4CAF50" />;
      case 'failed':
        return <AlertCircle size={20} color="#F44336" />;
      default:
        return <Clock size={20} color="#FF9800" />;
    }
  };

  const getStatusText = () => {
    switch (currentTask.status) {
      case 'running':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Pending';
    }
  };

  const getActionText = () => {
    const action = currentTask.isUnmarking ? 'Unmarking' : 'Marking';
    const type = currentTask.type === 'memorize' ? 'Memorized' : 'Revised';
    return `${action} ${type}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Background Task</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.taskInfo}>
              {getStatusIcon()}
              <View style={styles.taskDetails}>
                <Text style={styles.surahName}>{currentTask.surahName}</Text>
                <Text style={styles.actionText}>{getActionText()}</Text>
                <Text style={styles.statusText}>{getStatusText()}</Text>
              </View>
            </View>

            {currentTask.status === 'running' && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { width: `${progress}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressText}>
                  {currentTask.processedVerses} / {currentTask.totalVerses} verses ({progress}%)
                </Text>
              </View>
            )}

            {currentTask.status === 'failed' && currentTask.error && (
              <View style={styles.errorContainer}>
                <AlertCircle size={16} color="#F44336" />
                <Text style={styles.errorText}>{currentTask.error}</Text>
              </View>
            )}

            {currentTask.status === 'running' && (
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={cancelCurrentTask}
              >
                <Text style={styles.cancelButtonText}>Cancel Task</Text>
              </TouchableOpacity>
            )}

            {currentTask.status === 'completed' && (
              <View style={styles.completedContainer}>
                <CheckCircle size={16} color="#4CAF50" />
                <Text style={styles.completedText}>
                  Task completed successfully!
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    margin: 20,
    minWidth: 300,
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeButton: {
    padding: 5,
  },
  content: {
    gap: 16,
  },
  taskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskDetails: {
    flex: 1,
  },
  surahName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  actionText: {
    fontSize: 14,
    color: '#cccccc',
    marginTop: 2,
  },
  statusText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 2,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#cccccc',
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F4433620',
    borderRadius: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#F44336',
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  completedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#4CAF5020',
    borderRadius: 6,
  },
  completedText: {
    fontSize: 12,
    color: '#4CAF50',
    flex: 1,
  },
}); 