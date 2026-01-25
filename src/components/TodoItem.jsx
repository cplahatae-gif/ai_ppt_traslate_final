import React from 'react';

const TodoItem = ({ todo, onDelete }) => {
    return (
        <div className="todo-item">
            <span className="todo-text">{todo.text}</span>
            <button
                className="delete-btn"
                onClick={() => onDelete(todo.id)}
                aria-label="Delete todo"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    );
};

export default TodoItem;
