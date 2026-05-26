import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline, List, ListOrdered, Link2, Image as ImageIcon,
  Heading1, Heading2, Quote, AlignLeft, AlignCenter, AlignRight, Loader2,
  Undo2, Redo2, Eraser,
} from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Lightweight rich-text editor based on contentEditable + execCommand.
 * Props:
 *  - value: HTML string
 *  - onChange: (html) => void
 *  - onUploadImage: async (file) => string url   // optional, used for image button
 *  - placeholder: string
 *  - minHeight: tailwind class or px (default 240)
 */
export default function RichTextEditor({ value = '', onChange, onUploadImage, placeholder = 'Écrivez ici…', minHeight = 240 }) {
  const ref = useRef(null)
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [active, setActive] = useState({})

  // Sync external value into editor when it changes from outside (avoid caret jump)
  useEffect(() => {
    if (ref.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || ''
    }
  }, [value])

  const exec = (cmd, val = null) => {
    document.execCommand(cmd, false, val)
    ref.current?.focus()
    triggerChange()
    refreshActive()
  }

  const triggerChange = () => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    onChange?.(html)
  }

  const refreshActive = () => {
    setActive({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      ul: document.queryCommandState('insertUnorderedList'),
      ol: document.queryCommandState('insertOrderedList'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      alignRight: document.queryCommandState('justifyRight'),
    })
  }

  const handleHeading = (tag) => exec('formatBlock', `<${tag}>`)

  const handleLink = () => {
    const url = window.prompt('URL du lien :', 'https://')
    if (url) exec('createLink', url)
  }

  const handleImageButton = () => {
    if (onUploadImage) fileRef.current?.click()
    else {
      const url = window.prompt('URL de l\'image :', 'https://')
      if (url) exec('insertImage', url)
    }
  }

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await onUploadImage(file)
      if (url) exec('insertImage', url)
    } catch (err) {
      alert(err.message || 'Erreur lors de l\'upload de l\'image')
    }
    setUploading(false)
  }

  const handlePaste = (e) => {
    // Plain text paste to avoid messy formatting
    e.preventDefault()
    const text = (e.clipboardData || window.clipboardData).getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  const Btn = ({ icon: Icon, onClick, isActive, title, disabled }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'p-1.5 rounded-md transition-colors flex items-center justify-center',
        isActive ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <Icon size={14} />
    </button>
  )

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1.5 flex-wrap">
        <Btn icon={Bold} onClick={() => exec('bold')} isActive={active.bold} title="Gras (Ctrl+B)" />
        <Btn icon={Italic} onClick={() => exec('italic')} isActive={active.italic} title="Italique (Ctrl+I)" />
        <Btn icon={Underline} onClick={() => exec('underline')} isActive={active.underline} title="Souligné (Ctrl+U)" />
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <Btn icon={Heading1} onClick={() => handleHeading('h2')} title="Titre" />
        <Btn icon={Heading2} onClick={() => handleHeading('h3')} title="Sous-titre" />
        <Btn icon={Quote} onClick={() => exec('formatBlock', '<blockquote>')} title="Citation" />
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <Btn icon={List} onClick={() => exec('insertUnorderedList')} isActive={active.ul} title="Liste à puces" />
        <Btn icon={ListOrdered} onClick={() => exec('insertOrderedList')} isActive={active.ol} title="Liste numérotée" />
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <Btn icon={AlignLeft} onClick={() => exec('justifyLeft')} isActive={active.alignLeft} title="Aligner à gauche" />
        <Btn icon={AlignCenter} onClick={() => exec('justifyCenter')} isActive={active.alignCenter} title="Centrer" />
        <Btn icon={AlignRight} onClick={() => exec('justifyRight')} isActive={active.alignRight} title="Aligner à droite" />
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <Btn icon={Link2} onClick={handleLink} title="Insérer un lien" />
        <Btn icon={ImageIcon} onClick={handleImageButton} disabled={uploading} title="Insérer une image" />
        {uploading && <Loader2 size={13} className="animate-spin text-blue-500 ml-1" />}
        <span className="w-px h-5 bg-gray-300 mx-1" />
        <Btn icon={Undo2} onClick={() => exec('undo')} title="Annuler" />
        <Btn icon={Redo2} onClick={() => exec('redo')} title="Refaire" />
        <Btn icon={Eraser} onClick={() => exec('removeFormat')} title="Effacer le formatage" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
      </div>

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={triggerChange}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className="rte-content px-4 py-3 text-sm text-gray-800 focus:outline-none prose prose-sm max-w-none"
        style={{ minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight }}
      />

      <style>{`
        .rte-content:empty:before { content: attr(data-placeholder); color: #9CA3AF; pointer-events: none; }
        .rte-content h2 { font-size: 1.4rem; font-weight: 700; margin: .5rem 0; }
        .rte-content h3 { font-size: 1.15rem; font-weight: 600; margin: .4rem 0; }
        .rte-content blockquote { border-left: 3px solid #93C5FD; padding-left: .75rem; color: #4B5563; font-style: italic; margin: .5rem 0; }
        .rte-content ul { list-style: disc; padding-left: 1.25rem; margin: .25rem 0; }
        .rte-content ol { list-style: decimal; padding-left: 1.25rem; margin: .25rem 0; }
        .rte-content a { color: #2563EB; text-decoration: underline; }
        .rte-content img { max-width: 100%; border-radius: .5rem; margin: .5rem 0; }
      `}</style>
    </div>
  )
}
