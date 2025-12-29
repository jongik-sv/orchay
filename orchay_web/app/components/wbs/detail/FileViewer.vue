<template>
  <Dialog
    :visible="visible"
    :header="fileName"
    :modal="true"
    :closable="true"
    :dismissable-mask="true"
    class="file-viewer-dialog"
    data-testid="file-viewer-dialog"
    @update:visible="handleClose"
  >
    <!-- 로딩 상태 -->
    <div v-if="loading" class="flex items-center justify-center h-64">
      <div class="text-center">
        <ProgressSpinner stroke-width="4" animation-duration="1s" />
        <p class="mt-4 text-text-secondary">파일을 불러오는 중...</p>
      </div>
    </div>

    <!-- 에러 상태 -->
    <div v-else-if="error" class="text-center p-8">
      <i class="pi pi-exclamation-triangle text-danger text-4xl mb-4"></i>
      <p class="text-danger">{{ error }}</p>
      <Button
        label="다시 시도"
        icon="pi pi-refresh"
        class="mt-4"
        @click="loadFileContent"
      />
    </div>

    <!-- 콘텐츠 표시 -->
    <div v-else class="file-viewer-content">
      <!-- 마크다운 렌더링 (marked + Mermaid 인라인) -->
      <div
        v-if="isMarkdown"
        ref="markdownContainer"
        class="markdown-body prose prose-invert max-w-none"
      >
        <div v-if="renderedHtml" v-html="renderedHtml"></div>
        <div v-else class="flex items-center justify-center p-8">
          <ProgressSpinner stroke-width="4" animation-duration="1s" />
        </div>
      </div>

      <!-- 이미지 표시 -->
      <div v-else-if="isImage" class="image-viewer text-center">
        <img
          v-if="imageDataUrl"
          :src="imageDataUrl"
          :alt="fileName"
          class="max-w-full h-auto mx-auto"
        />
        <p class="text-sm text-text-muted mt-4">
          크기: {{ formatFileSize(fileSize) }}
        </p>
      </div>

      <!-- 코드 파일 (Monaco Editor) -->
      <ClientOnly v-else-if="isCodeFile">
        <MonacoEditor
          v-model="content"
          :lang="monacoLanguage"
          :options="monacoOptions"
          class="code-editor"
        />
        <template #fallback>
          <pre class="bg-bg-card p-4 rounded-lg overflow-x-auto"><code>{{ content }}</code></pre>
        </template>
      </ClientOnly>

      <!-- 기타 텍스트 파일 -->
      <div v-else class="code-viewer">
        <pre class="bg-bg-card p-4 rounded-lg overflow-x-auto"><code>{{ content }}</code></pre>
      </div>
    </div>
  </Dialog>
</template>

<script setup lang="ts">
/**
 * FileViewer - 통합 파일 뷰어 다이얼로그
 *
 * 책임:
 * - 파일 컨텐츠 로드 및 표시
 * - 파일 타입별 렌더링 (Markdown, Image, Code, Text)
 * - Monaco Editor로 코드 파일 문법 하이라이팅
 * - ProjectFile, DocumentInfo 타입 모두 지원
 */

import type { ProjectFile, DocumentInfo, FileContentResponse } from '~/types'
import { marked } from 'marked'
import mermaid from 'mermaid'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'

// marked에 highlight.js 연동
marked.use({
  renderer: {
    code(this: unknown, code: string | { text: string; lang?: string }, language?: string): string {
      // marked v17+에서 code는 객체일 수 있음
      let codeText: string
      let lang: string
      if (typeof code === 'object' && code !== null && 'text' in code) {
        codeText = code.text
        lang = code.lang || ''
      } else {
        codeText = code as string
        lang = language || ''
      }

      // mermaid는 별도 처리
      if (lang === 'mermaid') {
        return `<pre class="mermaid">${codeText}</pre>`
      }

      // highlight.js로 문법 강조
      if (lang && hljs.getLanguage(lang)) {
        const highlighted = hljs.highlight(codeText, { language: lang }).value
        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`
      }
      // 언어가 없으면 자동 감지
      const autoHighlighted = hljs.highlightAuto(codeText).value
      return `<pre><code class="hljs">${autoHighlighted}</code></pre>`
    }
  }
})

// ============================================================
// Types
// ============================================================
type FileInfo = ProjectFile | DocumentInfo

interface Props {
  file: FileInfo
  visible: boolean
  /** Task용 API 사용 여부 (taskId 필수) */
  taskId?: string
  /** 프로젝트 파일용 (이미지 경로 변환에 사용) */
  projectId?: string
}

const props = defineProps<Props>()

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'loaded', content: string): void
  (e: 'error', error: Error): void
}

const emit = defineEmits<Emits>()

// ============================================================
// State
// ============================================================
const content = ref<string>('')
const imageDataUrl = ref<string | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const markdownContainer = ref<HTMLElement | null>(null)
const mermaidInitialized = ref(false)
const renderedHtml = ref<string>('')

// ============================================================
// Computed - 파일 정보
// ============================================================
const fileName = computed(() => props.file.name)
const fileSize = computed(() => props.file.size ?? 0)
const fileExtension = computed(() => {
  const name = props.file.name.toLowerCase()
  const ext = name.split('.').pop() || ''
  return ext
})

// ============================================================
// Computed - 파일 타입 판단 (확장자 기반)
// ============================================================
const isMarkdown = computed(() => ['md', 'markdown'].includes(fileExtension.value))
const isImage = computed(() => ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fileExtension.value))
const isCodeFile = computed(() =>
  ['json', 'ts', 'js', 'tsx', 'jsx', 'vue', 'css', 'scss', 'html', 'xml', 'yaml', 'yml', 'py', 'sh', 'bash'].includes(fileExtension.value)
)

// ============================================================
// Computed - Monaco Editor
// ============================================================
const monacoLanguage = computed(() => {
  const langMap: Record<string, string> = {
    json: 'json',
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    vue: 'html',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    sh: 'shell',
    bash: 'shell'
  }
  return langMap[fileExtension.value] || 'plaintext'
})

const monacoOptions = {
  readOnly: true,
  minimap: { enabled: false },
  lineNumbers: 'on' as const,
  scrollBeyondLastLine: false,
  wordWrap: 'on' as const,
  fontSize: 13,
  theme: 'vs-dark',
  automaticLayout: true
}

// ============================================================
// Computed - Mermaid 다이어그램 추출
// ============================================================
const mermaidDiagrams = computed(() => {
  if (!isMarkdown.value || !content.value) return []
  // Windows 줄바꿈(\r\n)도 지원
  const regex = /```mermaid\r?\n([\s\S]*?)```/g
  const diagrams: string[] = []
  const matches = content.value.matchAll(regex)
  for (const match of matches) {
    diagrams.push(match[1].trim())
  }
  return diagrams
})

// Mermaid 블록을 placeholder로 대체 및 이미지 경로 변환
const processedContent = computed(() => {
  if (!isMarkdown.value || !content.value) return ''

  let processed = content.value
  let mermaidIndex = 0

  // 1. Mermaid 블록을 placeholder div로 대체 (원래 위치 유지)
  // Windows 줄바꿈(\r\n)도 지원
  const mermaidRegex = /```mermaid\r?\n([\s\S]*?)```/g
  processed = processed.replace(mermaidRegex, () => {
    const placeholder = `<div class="mermaid-placeholder" data-mermaid-index="${mermaidIndex}"></div>`
    mermaidIndex++
    return placeholder
  })

  // 2. 상대 이미지 경로를 API 경로로 변환
  const imageRegex = /!\[([^\]]*)\]\(\.?\/?([^)]+\.(png|jpg|jpeg|gif|webp|svg))\)/gi
  processed = processed.replace(imageRegex, (_, alt, imagePath) => {
    // 이미 절대 URL이면 그대로
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/api/')) {
      return `![${alt}](${imagePath})`
    }

    // Task 문서인 경우
    if (props.taskId) {
      const apiPath = `/api/tasks/${props.taskId}/documents/${imagePath}`
      return `![${alt}](${apiPath})`
    }

    // 프로젝트 파일인 경우 (file.path 기반)
    if (props.file.path) {
      // 파일 경로에서 디렉토리 추출
      const filePath = props.file.path.replace(/\\/g, '/')
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/'))
      // 상대 경로를 절대 경로로 변환
      const absoluteImagePath = `${fileDir}/${imagePath.replace(/^\.\//, '')}`
      const apiPath = `/api/files/content?path=${encodeURIComponent(absoluteImagePath)}`
      return `![${alt}](${apiPath})`
    }

    return `![${alt}](${imagePath})`
  })

  return processed
})

// ============================================================
// Mermaid 초기화
// ============================================================
async function initMermaid() {
  if (mermaidInitialized.value) return
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
      primaryColor: '#3b82f6',
      primaryTextColor: '#e8e8e8',
      primaryBorderColor: '#3d3d5c',
      lineColor: '#6c9bcf',
      secondaryColor: '#1e1e38',
      tertiaryColor: '#16213e'
    }
  })
  mermaidInitialized.value = true
}

async function renderMermaidDiagrams() {
  if (mermaidDiagrams.value.length === 0) return
  if (!markdownContainer.value) return

  await initMermaid()
  await nextTick()

  // placeholder div들을 찾아서 mermaid 다이어그램으로 교체
  const placeholders = markdownContainer.value.querySelectorAll('.mermaid-placeholder')

  for (const placeholder of placeholders) {
    const index = parseInt(placeholder.getAttribute('data-mermaid-index') || '0', 10)
    const diagramCode = mermaidDiagrams.value[index]
    if (!diagramCode) continue

    try {
      const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, diagramCode)
      // placeholder를 mermaid 컨테이너로 교체
      const container = document.createElement('div')
      container.className = 'mermaid-container my-4'
      container.innerHTML = svg
      placeholder.replaceWith(container)
    } catch (e) {
      console.error('Mermaid render error:', e)
      placeholder.innerHTML = `<pre class="text-danger text-sm p-2">Mermaid 렌더링 실패: ${e instanceof Error ? e.message : 'Unknown error'}</pre>`
    }
  }
}

// ============================================================
// Watchers
// ============================================================
watch(
  () => props.visible,
  (newVisible) => {
    if (newVisible) {
      loadFileContent()
    }
  },
  { immediate: true }
)

// 마크다운 렌더링 후 Mermaid 처리
watch(
  () => processedContent.value,
  async (newContent) => {
    if (newContent && isMarkdown.value) {
      try {
        renderedHtml.value = await marked(newContent)
        // DOM 업데이트 후 Mermaid 렌더링
        await nextTick()
        await renderMermaidDiagrams()
      } catch (e) {
        console.error('[FileViewer] Markdown rendering error:', e)
        renderedHtml.value = ''
      }
    } else {
      renderedHtml.value = ''
    }
  },
  { immediate: true }
)

// ============================================================
// Methods
// ============================================================

/**
 * 파일 내용 로드
 */
async function loadFileContent(): Promise<void> {
  loading.value = true
  error.value = null
  content.value = ''
  imageDataUrl.value = null

  try {
    // Task 문서인 경우 taskId 기반 API 사용
    let apiUrl: string
    if (props.taskId) {
      const projectParam = props.projectId ? `?project=${encodeURIComponent(props.projectId)}` : ''
      apiUrl = `/api/tasks/${props.taskId}/documents/${encodeURIComponent(props.file.name)}${projectParam}`
    } else {
      apiUrl = `/api/files/content?path=${encodeURIComponent(props.file.path)}`
    }

    if (isImage.value) {
      // 이미지: ArrayBuffer로 받아서 Data URL 생성
      const blob = await $fetch<Blob>(apiUrl, { responseType: 'blob' })

      const reader = new FileReader()
      reader.onload = () => {
        imageDataUrl.value = reader.result as string
      }
      reader.readAsDataURL(blob)
    } else {
      // 텍스트 파일
      const response = await $fetch<FileContentResponse | { content: string }>(apiUrl)
      content.value = response.content
      emit('loaded', response.content)
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : '파일을 불러오는 데 실패했습니다'
    error.value = errMsg
    emit('error', new Error(errMsg))
    console.error('File load error:', e)
  } finally {
    loading.value = false
  }
}

/**
 * 다이얼로그 닫기
 */
function handleClose(): void {
  emit('update:visible', false)
  // 상태 초기화
  content.value = ''
  imageDataUrl.value = null
  error.value = null
  renderedHtml.value = ''
}

/**
 * 파일 크기 포맷팅
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>

<style scoped>
.file-viewer-content {
  height: calc(80vh - 4rem);
  overflow-y: auto;
}

.code-editor {
  height: 100%;
  min-height: 400px;
}

/* Mermaid 컨테이너 스타일 */
.mermaid-container {
  display: flex;
  justify-content: center;
  padding: 1rem;
  background-color: var(--color-bg-card);
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
}

.mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
