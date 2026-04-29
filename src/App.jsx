import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, deleteDoc, updateDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'
import './App.css'

const CheckIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="2,6 5,9 10,3" />
  </svg>
)
const PlusIcon = () => (
  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" />
  </svg>
)
const TrashIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1,3 13,3" />
    <path d="M5,3V2a1,1,0,0,1,1-1h2a1,1,0,0,1,1,1v1" />
    <path d="M2,3l1,9a1,1,0,0,0,1,1h6a1,1,0,0,0,1-1l1-9" />
    <line x1="5.5" y1="6" x2="5.5" y2="10" /><line x1="8.5" y1="6" x2="8.5" y2="10" />
  </svg>
)
const UploadIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M7 9V1M4 4l3-3 3 3" /><path d="M2 11h10" />
  </svg>
)
const DownloadIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
    <path d="M7 1v8M4 6l3 3 3-3" /><path d="M2 11h10" />
  </svg>
)

const COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899']
const END_DROP_ID = '__end__'

export default function App() {
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [dragId, setDragId] = useState(null)       // task being dragged
  const [dragCatId, setDragCatId] = useState(null) // category being dragged
  const [dragOverId, setDragOverId] = useState(null) // hovered item id (task, category, or END_DROP_ID)
  const [editing, setEditing] = useState(null) // { id, type: 'task'|'category' }
  const [contextMenu, setContextMenu] = useState(null)
  const [newCatName, setNewCatName] = useState('')
  const [colorPickerCatId, setColorPickerCatId] = useState(null)
  const [colorPickerValue, setColorPickerValue] = useState('#000000')
  const catInputRef = useRef(null)

  // Unified root list: uncategorized tasks + categories sorted by the same `order` field
  const rootItems = [
    ...tasks.filter(t => !t.categoryId).map(t => ({ ...t, _type: 'task' })),
    ...categories.map(c => ({ ...c, _type: 'category' })),
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'categories'), orderBy('order', 'asc')),
      snap => setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(query(collection(db, 'tasks'), orderBy('order', 'asc')),
      snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false) })
    return () => { u1(); u2() }
  }, [])

  useEffect(() => { if (contextMenu) catInputRef.current?.focus() }, [contextMenu])

  useEffect(() => {
    function close() { setContextMenu(null) }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  function handleContextMenu(e) {
    e.preventDefault()
    const catEl = e.target.closest('[data-cat-id]')
    setContextMenu({ x: e.clientX, y: e.clientY, catId: catEl?.dataset?.catId ?? null })
    setNewCatName('')
  }

  async function addTask(e) {
    e.preventDefault()
    const text = input.trim(); if (!text) return
    setInput('')
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(r => r.order ?? 0)) : 0
    await addDoc(collection(db, 'tasks'), { text, done: false, order: maxOrder + 1, categoryId: null, createdAt: serverTimestamp() })
  }

  async function toggleTask(task) {
    await updateDoc(doc(db, 'tasks', task.id), { done: !task.done })
  }

  async function deleteTask(id) { await deleteDoc(doc(db, 'tasks', id)) }

  function downloadJSON() {
    const data = tasks.map(t => ({ text: t.text, done: t.done, category: categories.find(c => c.id === t.categoryId)?.name ?? null, createdAt: t.createdAt?.toDate?.()?.toISOString() ?? null }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tasks-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url)
  }

  async function uploadJSON(e) {
    const file = e.target.files[0]; if (!file) return; e.target.value = ''
    let data; try { data = JSON.parse(await file.text()) } catch { alert('Invalid JSON'); return }
    if (!Array.isArray(data)) { alert('JSON must be an array'); return }
    const batch = writeBatch(db)
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(r => r.order ?? 0)) : 0
    data.forEach((item, i) => {
      if (!item.text) return
      batch.set(doc(collection(db, 'tasks')), { text: item.text, done: item.done ?? false, categoryId: categories.find(c => c.name === item.category)?.id ?? null, order: maxOrder + i + 1, createdAt: serverTimestamp() })
    })
    await batch.commit()
  }

  async function addCategory(e) {
    e.preventDefault()
    const name = newCatName.trim(); if (!name) { setContextMenu(null); return }
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(r => r.order ?? 0)) : 0
    await addDoc(collection(db, 'categories'), { name, color: COLORS[categories.length % COLORS.length], order: maxOrder + 1, createdAt: serverTimestamp() })
    setNewCatName(''); setContextMenu(null)
  }

  async function changeCategoryColor(catId, color) {
    await updateDoc(doc(db, 'categories', catId), { color })
    setColorPickerCatId(null)
  }

  async function renameTask(id, value) {
    const trimmed = value.trim()
    if (trimmed) await updateDoc(doc(db, 'tasks', id), { text: trimmed })
    setEditing(null)
  }

  async function renameCategory(id, value) {
    const trimmed = value.trim()
    if (trimmed) await updateDoc(doc(db, 'categories', id), { name: trimmed })
    setEditing(null)
  }

  async function deleteCategory(catId) {
    await deleteDoc(doc(db, 'categories', catId))
    const batch = writeBatch(db)
    tasks.filter(t => t.categoryId === catId).forEach(t => batch.update(doc(db, 'tasks', t.id), { categoryId: null }))
    await batch.commit()
    setContextMenu(null)
  }

  // ── Drag handlers ──

  function onDragEnd() { setDragId(null); setDragCatId(null); setDragOverId(null) }
  function onDragOver(e, id) { e.preventDefault(); e.stopPropagation(); setDragOverId(id) }
  function onDragLeave() { setDragOverId(null) }

  // Drop on a root-level item (uncategorized task or category header).
  // Task → category header: goes INTO the category.
  // Everything else: reorder in the unified root list.
  async function onDropOnRootItem(e, targetItem) {
    e.stopPropagation()
    const activeDragId = dragId || dragCatId
    if (!activeDragId || activeDragId === targetItem.id) { setDragOverId(null); return }

    if (dragId && targetItem._type === 'category') {
      // File into folder
      const catTasks = tasks.filter(t => t.categoryId === targetItem.id)
      const maxOrder = catTasks.length > 0 ? Math.max(...catTasks.map(t => t.order ?? 0)) : 0
      await updateDoc(doc(db, 'tasks', dragId), { categoryId: targetItem.id, order: maxOrder + 1 })
      setDragId(null); setDragOverId(null); return
    }

    // Reorder: build new root list with dragged item inserted before target
    const draggedTask = dragId ? tasks.find(t => t.id === dragId) : null
    const draggedCat = dragCatId ? categories.find(c => c.id === dragCatId) : null
    const draggedAsRoot = draggedTask
      ? { ...draggedTask, _type: 'task', categoryId: null }
      : { ...draggedCat, _type: 'category' }

    const withoutDragged = rootItems.filter(r => r.id !== activeDragId)
    const targetIdx = withoutDragged.findIndex(r => r.id === targetItem.id)
    withoutDragged.splice(targetIdx, 0, draggedAsRoot)

    const batch = writeBatch(db)
    withoutDragged.forEach((r, i) => {
      if (r._type === 'task') batch.update(doc(db, 'tasks', r.id), { order: i, categoryId: null })
      else batch.update(doc(db, 'categories', r.id), { order: i })
    })
    await batch.commit()
    setDragId(null); setDragCatId(null); setDragOverId(null)
  }

  // Drop on a task inside a category: move dragged task into that category, before the target.
  async function onDropOnCatTask(e, targetTask) {
    e.stopPropagation()
    if (!dragId || dragId === targetTask.id) { setDragOverId(null); return }
    const dragged = tasks.find(t => t.id === dragId)
    if (!dragged) return

    const newCatId = targetTask.categoryId
    const catTasks = tasks.filter(t => t.categoryId === newCatId && t.id !== dragId)
    const targetIdx = catTasks.findIndex(t => t.id === targetTask.id)
    catTasks.splice(targetIdx, 0, { ...dragged, categoryId: newCatId })

    const batch = writeBatch(db)
    catTasks.forEach((t, i) => batch.update(doc(db, 'tasks', t.id), { order: i, categoryId: newCatId }))
    await batch.commit()
    setDragId(null); setDragOverId(null)
  }

  // Drop on the bottom end zone: append to end of root list (uncategorizes a task or moves category last).
  async function onDropOnEnd(e) {
    e.stopPropagation()
    const activeDragId = dragId || dragCatId
    if (!activeDragId) { setDragOverId(null); return }
    const maxOrder = rootItems.length > 0 ? Math.max(...rootItems.map(r => r.order ?? 0)) : 0
    if (dragId) {
      await updateDoc(doc(db, 'tasks', dragId), { categoryId: null, order: maxOrder + 1 })
    } else {
      await updateDoc(doc(db, 'categories', dragCatId), { order: maxOrder + 1 })
    }
    setDragId(null); setDragCatId(null); setDragOverId(null)
  }

  const progress = tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.done).length / tasks.length) * 100)

  return (
    <div className="app" onContextMenu={handleContextMenu}>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="inner">
        <div className="add-task-container">
          <form className="add-task-form" onSubmit={addTask}>
            <button type="submit" className="add-btn-circle"><PlusIcon /></button>
            <input className="task-input" type="text" placeholder="Add a task..." value={input} onChange={e => setInput(e.target.value)} autoFocus />
            <button type="button" className="download-btn" onClick={downloadJSON}><DownloadIcon /></button>
            <label className="download-btn"><UploadIcon /><input type="file" accept=".json" onChange={uploadJSON} style={{ display: 'none' }} /></label>
          </form>
        </div>

        {loading ? <div className="loading">Loading...</div> : (
          <div className="task-list">
            {rootItems.map(item => {
              if (item._type === 'task') {
                return (
                  <TaskItem key={item.id} task={item}
                    dragging={dragId === item.id}
                    dragOver={dragOverId === item.id}
                    isEditing={editing?.id === item.id}
                    onDragStart={(e) => { e.stopPropagation(); setDragId(item.id) }}
                    onDragEnd={onDragEnd}
                    onDragOver={(e) => onDragOver(e, item.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDropOnRootItem(e, item)}
                    onToggle={toggleTask} onDelete={deleteTask}
                    onStartEdit={() => setEditing({ id: item.id, type: 'task' })}
                    onCommitEdit={(val) => renameTask(item.id, val)}
                  />
                )
              }
              const cat = item
              const catTasks = tasks.filter(t => t.categoryId === cat.id)
              const pending = catTasks.filter(t => !t.done)
              const done = catTasks.filter(t => t.done)
              return (
                <div key={cat.id}>
                  <div
                    draggable={editing?.id !== cat.id && colorPickerCatId !== cat.id}
                    onDragStart={(e) => { e.stopPropagation(); setDragCatId(cat.id) }}
                    onDragEnd={onDragEnd}
                    className={`cat-section-header ${dragCatId === cat.id ? 'cat-dragging' : ''} ${dragOverId === cat.id && dragCatId ? 'cat-drag-over' : ''} ${dragOverId === cat.id && dragId ? 'drop-over-header' : ''}`}
                    data-cat-id={cat.id}
                    onDragOver={(e) => onDragOver(e, cat.id)}
                    onDragLeave={onDragLeave}
                    onDrop={(e) => onDropOnRootItem(e, cat)}
                  >
                    <button className="cat-drag-handle" aria-label="Drag">⠿</button>
                    {colorPickerCatId === cat.id ? (
                      <span className="cat-color-picker-ui" draggable={false} onClick={e => e.stopPropagation()}>
                        <input type="color" className="cat-color-swatch-input"
                          value={colorPickerValue}
                          onChange={e => setColorPickerValue(e.target.value)}
                        />
                        <button className="cat-color-confirm" onClick={() => changeCategoryColor(cat.id, colorPickerValue)}>✓</button>
                      </span>
                    ) : (
                      <span className="cat-dot" style={{ background: cat.color }}
                        onDoubleClick={e => { e.stopPropagation(); setColorPickerCatId(cat.id); setColorPickerValue(cat.color) }}
                      />
                    )}
                    {editing?.id === cat.id ? (
                      <input
                        className="cat-name-input"
                        defaultValue={cat.name}
                        autoFocus
                        onFocus={e => e.target.select()}
                        onBlur={e => renameCategory(cat.id, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
                          if (e.key === 'Escape') { setEditing(null) }
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span className="cat-section-name" onDoubleClick={() => setEditing({ id: cat.id, type: 'category' })}>{cat.name}</span>
                    )}
                    <span className="cat-count">{catTasks.length}</span>
                  </div>
                  {pending.map(task => (
                    <TaskItem key={task.id} task={task} indent
                      dragging={dragId === task.id}
                      dragOver={dragOverId === task.id}
                      isEditing={editing?.id === task.id}
                      onDragStart={(e) => { e.stopPropagation(); setDragId(task.id) }}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOver(e, task.id)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDropOnCatTask(e, task)}
                      onToggle={toggleTask} onDelete={deleteTask}
                      onStartEdit={() => setEditing({ id: task.id, type: 'task' })}
                      onCommitEdit={(val) => renameTask(task.id, val)}
                    />
                  ))}
                  {done.length > 0 && <div className="section-label" style={{ paddingLeft: 40 }}>Completed</div>}
                  {done.map(task => (
                    <TaskItem key={task.id} task={task} indent
                      dragging={dragId === task.id}
                      dragOver={dragOverId === task.id}
                      isEditing={editing?.id === task.id}
                      onDragStart={(e) => { e.stopPropagation(); setDragId(task.id) }}
                      onDragEnd={onDragEnd}
                      onDragOver={(e) => onDragOver(e, task.id)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDropOnCatTask(e, task)}
                      onToggle={toggleTask} onDelete={deleteTask}
                      onStartEdit={() => setEditing({ id: task.id, type: 'task' })}
                      onCommitEdit={(val) => renameTask(task.id, val)}
                    />
                  ))}
                </div>
              )
            })}

            {/* Bottom drop zone — moves item to end of root list, uncategorizes tasks */}
            {(dragId || dragCatId) && (
              <div
                className={`end-drop-zone ${dragOverId === END_DROP_ID ? 'end-drop-active' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(END_DROP_ID) }}
                onDragLeave={onDragLeave}
                onDrop={onDropOnEnd}
              />
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={e => e.stopPropagation()}>
          {contextMenu.catId ? (
            <button className="context-delete-btn" onClick={() => deleteCategory(contextMenu.catId)}>
              Delete category
            </button>
          ) : (
            <form onSubmit={addCategory}>
              <input ref={catInputRef} className="context-input" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="New category name..." maxLength={24} />
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function TaskItem({ task, dragging, dragOver, isEditing, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, onToggle, onDelete, onStartEdit, onCommitEdit, indent }) {
  return (
    <div
      draggable={!isEditing}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`task-item ${dragOver ? 'drag-over' : ''} ${dragging ? 'dragging' : ''}`}
      style={{ paddingLeft: indent ? 40 : undefined }}
    >
      <button className="drag-handle" aria-label="Drag">⠿</button>
      <button className={`checkbox ${task.done ? 'checked' : ''}`} onClick={() => onToggle(task)}><CheckIcon /></button>
      {isEditing ? (
        <input
          className="task-text-input"
          defaultValue={task.text}
          autoFocus
          onFocus={e => e.target.select()}
          onBlur={e => onCommitEdit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
            if (e.key === 'Escape') onCommitEdit(task.text)
          }}
        />
      ) : (
        <span className={`task-text ${task.done ? 'done' : ''}`} onDoubleClick={onStartEdit}>{task.text}</span>
      )}
      <button className="delete-btn" onClick={() => onDelete(task.id)}><TrashIcon /></button>
    </div>
  )
}
