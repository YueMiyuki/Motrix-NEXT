<template>
  <div
    ref="container"
    style="position: relative; user-select: none; overflow-x: hidden; touch-action: none"
  >
    <slot v-bind="{ selected: intersected }" />
  </div>
</template>

<script lang="ts">
const getCoords = (e, containerRect) => ({
  x: e.clientX - containerRect.left,
  y: e.clientY - containerRect.top,
})

const getDimensions = (p1, p2) => ({
  width: Math.abs(p1.x - p2.x),
  height: Math.abs(p1.y - p2.y),
})

const collisionCheck = (node1, node2) =>
  node1.left < node2.left + node2.width &&
  node1.left + node1.width > node2.left &&
  node1.top < node2.top + node2.height &&
  node1.top + node1.height > node2.top

export default {
  name: 'mo-drag-select',
  props: {
    attribute: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: '#bad7fb',
    },
    opacity: {
      type: Number,
      default: 0.7,
    },
  },
  data() {
    return {
      intersected: [],
      cleanupListeners: null,
    }
  },
  watch: {
    intersected(i) {
      this.$emit('change', i)
    },
  },
  mounted() {
    const { container } = this.$refs
    const self = this

    let containerRect = container.getBoundingClientRect()
    const DRAG_START_THRESHOLD = 4
    const box = this.createBox()
    let start = { x: 0, y: 0 }
    let end = { x: 0, y: 0 }
    let dragging = false

    function touchStart(e) {
      e.preventDefault()
      startDrag(e.touches[0])
    }

    function touchMove(e) {
      e.preventDefault()
      drag(e.touches[0])
    }

    function startDrag(e) {
      containerRect = container.getBoundingClientRect()
      start = getCoords(e, containerRect)
      end = start
      dragging = false
      document.addEventListener('mousemove', drag)
      document.addEventListener('touchmove', touchMove)

      box.style.top = start.y + 'px'
      box.style.left = start.x + 'px'
      box.style.width = '0'
      box.style.height = '0'

      container.prepend(box)
    }

    function drag(e) {
      end = getCoords(e, containerRect)
      const dimensions = getDimensions(start, end)

      if (!dragging) {
        dragging =
          dimensions.width >= DRAG_START_THRESHOLD || dimensions.height >= DRAG_START_THRESHOLD
      }
      if (!dragging) {
        return
      }

      if (end.x < start.x) {
        box.style.left = end.x + 'px'
      }
      if (end.y < start.y) {
        box.style.top = end.y + 'px'
      }
      box.style.width = dimensions.width + 'px'
      box.style.height = dimensions.height + 'px'

      self.intersection(box)
    }

    function endDrag() {
      start = { x: 0, y: 0 }
      end = { x: 0, y: 0 }
      dragging = false

      box.style.width = 0
      box.style.height = 0

      document.removeEventListener('mousemove', drag)
      document.removeEventListener('touchmove', touchMove)
      box.remove()
    }

    container.addEventListener('mousedown', startDrag)
    container.addEventListener('touchstart', touchStart)

    document.addEventListener('mouseup', endDrag)
    document.addEventListener('touchend', endDrag)

    this.cleanupListeners = () => {
      endDrag()
      container.removeEventListener('mousedown', startDrag)
      container.removeEventListener('touchstart', touchStart)
      document.removeEventListener('mouseup', endDrag)
      document.removeEventListener('touchend', endDrag)
    }
  },
  beforeUnmount() {
    if (this.cleanupListeners) {
      this.cleanupListeners()
      this.cleanupListeners = null
    }
  },
  methods: {
    createBox() {
      const box = document.createElement('div')
      box.setAttribute('data-drag-box-component', '')
      box.style.position = 'absolute'
      box.style.backgroundColor = this.color
      box.style.opacity = this.opacity
      box.style.zIndex = '1000'

      return box
    },
    intersection(box) {
      const containerEl = this.$refs.container
      const rect = box.getBoundingClientRect()
      const intersected = []
      const children = containerEl.children

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child === box) continue
        if (collisionCheck(rect, child.getBoundingClientRect())) {
          if (child.hasAttribute(this.attribute)) {
            intersected.push(child.getAttribute(this.attribute))
          }
        }
      }

      if (intersected.length !== this.intersected.length) {
        this.intersected = intersected
        return
      }

      for (let i = 0; i < intersected.length; i += 1) {
        if (intersected[i] !== this.intersected[i]) {
          this.intersected = intersected
          return
        }
      }
    },
  },
}
</script>
