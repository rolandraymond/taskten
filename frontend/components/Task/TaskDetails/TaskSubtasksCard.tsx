import React from 'react';
import TaskSubtasksSection from '../TaskForm/TaskSubtasksSection';
import { Task } from '../../../entities/Task';

interface TaskSubtasksCardProps {
    task: Task;
    subtasks: Task[];
    onSubtasksChange: (subtasks: Task[]) => void;
    onSubtaskUpdate?: (subtask: Task) => Promise<void>;
    onSave: (subtasks: Task[]) => void;
}

const TaskSubtasksCard: React.FC<TaskSubtasksCardProps> = ({
    task,
    subtasks,
    onSubtasksChange,
    onSubtaskUpdate,
    onSave,
}) => {
    if (!task?.id) {
        return null;
    }

    return (
        <div className="rounded-lg border-2 border-gray-50 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <TaskSubtasksSection
                parentTaskId={task.id}
                subtasks={subtasks}
                onSubtasksChange={onSubtasksChange}
                onSubtaskUpdate={onSubtaskUpdate}
                onSave={onSave}
            />
        </div>
    );
};

export default TaskSubtasksCard;