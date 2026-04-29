import { useState, useEffect } from 'react'
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from './firebase'
import './App.css'

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,6 5,9 10,3" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="6" y1="1" x2="6" y2="11" />
    <line x1="1" y1="6" x2="11" y2="6" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,3 13,3" />
    <path d="M5,3V2a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1v1" />
    <path d="M2,3l1,9a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1l1-9" />
    <line x1="5.5" y1="6" x2="5.5" y2="10" />
    <line x1="8.5" y1="6" x2="8.5" y2="10" />
  </svg>
)

const DragIcon = () => (
  <svg viewBox="0 0 14 14" fill="currentColor" width="14" height="14">
    <circle cx="5" cy="3.5" r="1.2" />
    <circle cx="9" cy="3.5" r="1.2" />
    <circle cx="5" cy="7" r="1.2" />
    <circle cx="9" cy="7" r="1.2" />
    <circle cx="5" cy="10.5" r="1.2" />
    <circle cx="9" cy="10.5" r="1.2" />
  </svg>
)

export default function App() {
  const [tasks, setTasks] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  )

  useEffect(() => {
    const q = query(collection(db, 'tasks'), orderBy('order', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [])

  async function addTask(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setInput('')
    const maxOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order ?? 0)) : 0
    await addDoc(collection(db, 'tasks'), {
      text,
      done: false,
      order: maxOrder + 1,
      createdAt: serverTimestamp(),
    })
  }

  async function toggleTask(task) {
    await updateDoc(doc(db, 'tasks', task.id), { done: !task.done })
  }

  async function deleteTask(id) {
    await deleteDoc(doc(db, 'tasks', id))
  }

  async function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = tasks.findIndex(t => t.id === active.id)
    const newIndex = tasks.findIndex(t => t.id === over.id)
    const reordered = arrayMove(tasks, oldIndex, newIndex)

    setTasks(reordered)

    const batch = writeBatch(db)
    reordered.forEach((task, i) => {
      batch.update(doc(db, 'tasks', task.id), { order: i })
    })
    await batch.commit()
  }

  const pending = tasks.filter(t => !t.done)
  const completed = tasks.filter(t => t.done)
  const total = tasks.length
  const progress = total === 0 ? 0 : Math.round((completed.length / total) * 100)

  return (
    <div className="app">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="inner">
        <div className="add-task-container">
          <form className="add-task-form" onSubmit={addTask}>
            <button type="submit" className="add-btn-circle" aria-label="Add task">
              <PlusIcon />
            </button>
            <input
              className="task-input"
              type="text"
              placeholder="Add a task..."
              value={input}
              onChange={e => setInput(e.target.value)}
              autoFocus
            />
          </form>
        </div>

        <div className="task-list">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : tasks.length === 0 ? null : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                {pending.length > 0 && (
                  <>
                    {completed.length > 0 && <div className="section-label">To Do</div>}
                    {pending.map(task => (
                      <SortableTaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                    ))}
                  </>
                )}
                {completed.length > 0 && (
                  <>
                    <div className="section-label">Completed</div>
                    {completed.map(task => (
                      <SortableTaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                    ))}
                  </>
                )}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>
    </div>
  )
}

function SortableTaskItem({ task, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} className="task-item">
      <button
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder"
      >
        <DragIcon />
      </button>
      <button
        className={`checkbox ${task.done ? 'checked' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
      >
        <CheckIcon />
      </button>
      <span className={`task-text ${task.done ? 'done' : ''}`}>{task.text}</span>
      <button
        className="delete-btn"
        onClick={() => onDelete(task.id)}
        aria-label="Delete task"
      >
        <TrashIcon />
      </button>
    </div>
  )
}
