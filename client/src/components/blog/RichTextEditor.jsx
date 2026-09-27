import { useState, useRef, useEffect } from 'react'
import {
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link, Image, Undo, Redo, Code, Eye, Minus, Eraser
} from 'lucide-react'

export default function RichTextEditor({ value = '', onChange, placeholder = 'Rédigez votre article ici...' }) {
  const editorRef = useRef(null)
  const [showCode, setShowCode] = useState(false)
  const [htmlCode, setHtmlCode] = useState(value)
  const [activeFormats, setActiveFormats] = useState({})

  // Initialisation du contenu
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value || ''
      }
    }
    setHtmlCode(value || '')
  }, [value])

  const execute = (command, val = null) => {
    if (showCode) return
    editorRef.current?.focus()
    document.execCommand(command, false, val)
    handleInput()
    checkFormats()
  }

  const handleInput = () => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    setHtmlCode(html)
    if (onChange) onChange(html)
  }

  const checkFormats = () => {
    if (!editorRef.current) return
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      ul: document.queryCommandState('insertUnorderedList'),
      ol: document.queryCommandState('insertOrderedList'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight'),
    })
  }

  const handleInsertLink = () => {
    const url = window.prompt('Entrez l\'URL du lien :', 'https://')
    if (url && url.trim()) {
      execute('createLink', url.trim())
    }
  }

  const handleInsertImage = () => {
    const url = window.prompt('Entrez l\'URL de l\'image :', 'https://')
    if (url && url.trim()) {
      execute('insertImage', url.trim())
    }
  }

  const handleCodeChange = (e) => {
    const newHtml = e.target.value
    setHtmlCode(newHtml)
    if (editorRef.current) {
      editorRef.current.innerHTML = newHtml
    }
    if (onChange) onChange(newHtml)
  }

  const ToolBtn = ({ onClick, active, icon: Icon, title }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg text-sm transition-colors ${
        active
          ? 'bg-blue-100 text-blue-700 font-bold'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <Icon size={16} />
    </button>
  )

  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-sm focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
      {/* Barre d'outils WYSIWYG */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-slate-50 border-b border-gray-200 text-gray-700 select-none">
        {/* Historique */}
        <ToolBtn onClick={() => execute('undo')} icon={Undo} title="Annuler" />
        <ToolBtn onClick={() => execute('redo')} icon={Redo} title="Rétablir" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Titres */}
        <ToolBtn onClick={() => execute('formatBlock', '<h1>')} icon={Heading1} title="Titre 1" />
        <ToolBtn onClick={() => execute('formatBlock', '<h2>')} icon={Heading2} title="Titre 2" />
        <ToolBtn onClick={() => execute('formatBlock', '<h3>')} icon={Heading3} title="Titre 3" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Formatage texte */}
        <ToolBtn onClick={() => execute('bold')} active={activeFormats.bold} icon={Bold} title="Gras" />
        <ToolBtn onClick={() => execute('italic')} active={activeFormats.italic} icon={Italic} title="Italique" />
        <ToolBtn onClick={() => execute('underline')} active={activeFormats.underline} icon={Underline} title="Souligné" />
        <ToolBtn onClick={() => execute('strikeThrough')} active={activeFormats.strike} icon={Strikethrough} title="Barré" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Listes & Citations */}
        <ToolBtn onClick={() => execute('insertUnorderedList')} active={activeFormats.ul} icon={List} title="Liste à puces" />
        <ToolBtn onClick={() => execute('insertOrderedList')} active={activeFormats.ol} icon={ListOrdered} title="Liste numérotée" />
        <ToolBtn onClick={() => execute('formatBlock', '<blockquote>')} icon={Quote} title="Citation" />
        <ToolBtn onClick={() => execute('insertHorizontalRule')} icon={Minus} title="Ligne séparatrice" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Alignement */}
        <ToolBtn onClick={() => execute('justifyLeft')} active={activeFormats.justifyLeft} icon={AlignLeft} title="Aligner à gauche" />
        <ToolBtn onClick={() => execute('justifyCenter')} active={activeFormats.justifyCenter} icon={AlignCenter} title="Centrer" />
        <ToolBtn onClick={() => execute('justifyRight')} active={activeFormats.justifyRight} icon={AlignRight} title="Aligner à droite" />
        <ToolBtn onClick={() => execute('justifyFull')} icon={AlignJustify} title="Justifier" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Médias & Liens */}
        <ToolBtn onClick={handleInsertLink} icon={Link} title="Insérer un lien" />
        <ToolBtn onClick={handleInsertImage} icon={Image} title="Insérer une image par URL" />
        <ToolBtn onClick={() => execute('removeFormat')} icon={Eraser} title="Effacer le formatage" />
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Basculer vue code HTML */}
        <button
          type="button"
          onClick={() => setShowCode(!showCode)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold ml-auto transition-colors ${
            showCode ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
          }`}
          title="Basculer code HTML / Éditeur visuel"
        >
          {showCode ? <Eye size={13} /> : <Code size={13} />}
          {showCode ? 'Visuel' : 'Code HTML'}
        </button>
      </div>

      {/* Zone d'édition */}
      {showCode ? (
        <textarea
          value={htmlCode}
          onChange={handleCodeChange}
          rows={12}
          className="w-full p-4 font-mono text-xs text-gray-800 bg-gray-900 text-green-400 focus:outline-none resize-y"
          placeholder="Code HTML brut de l'article..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyUp={checkFormats}
          onMouseUp={checkFormats}
          data-placeholder={placeholder}
          className="prose max-w-none p-5 min-h-[260px] focus:outline-none text-gray-800 text-sm sm:text-base leading-relaxed overflow-y-auto"
          style={{ wordBreak: 'break-word' }}
        />
      )}
    </div>
  )
}
