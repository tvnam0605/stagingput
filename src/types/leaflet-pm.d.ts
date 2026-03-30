import 'leaflet'

declare module 'leaflet' {
  // Options khi enable pm trên layer
  interface PMEnableOptions {
    allowSelfIntersection?: boolean
    snappable?: boolean
    snapDistance?: number
    preventMarkerRemoval?: boolean
    draggable?: boolean
  }

  // PM instance trên từng layer (Rectangle, Polygon, ...)
  interface PM {
    enable(options?: PMEnableOptions): void
    disable(): void
    enabled(): boolean
    toggleEdit(options?: PMEnableOptions): void
  }

  // PM controls trên Map
  interface PMMap {
    addControls(options?: {
      position?: ControlPosition
      drawMarker?: boolean
      drawCircleMarker?: boolean
      drawPolyline?: boolean
      drawRectangle?: boolean
      drawPolygon?: boolean
      drawCircle?: boolean
      drawText?: boolean
      editMode?: boolean
      dragMode?: boolean
      cutPolygon?: boolean
      removalMode?: boolean
      rotateMode?: boolean
    }): void
    removeControls(): void
    enableDraw(shape: string, options?: Record<string, unknown>): void
    disableDraw(shape?: string): void
    enableGlobalEditMode(options?: PMEnableOptions): void
    disableGlobalEditMode(): void
    globalEditModeEnabled(): boolean
    enableGlobalDragMode(): void
    disableGlobalDragMode(): void
    globalDragModeEnabled(): boolean
    enableGlobalRemovalMode(): void
    disableGlobalRemovalMode(): void
    globalRemovalModeEnabled(): boolean
  }

  // Merge vào L.Map
  interface Map {
    pm: PMMap
  }

  // Merge vào tất cả layer có thể edit
  interface Layer {
    pm: PM
  }

  // Event types cho pm:create, pm:edit, pm:dragend, ...
  interface LeafletEventHandlerFnMap {
    'pm:create'?:       (e: { layer: Layer; shape: string }) => void
    'pm:edit'?:         (e: { layer: Layer }) => void
    'pm:dragstart'?:    (e: { layer: Layer }) => void
    'pm:dragend'?:      (e: { layer: Layer }) => void
    'pm:resize'?:       (e: { layer: Layer }) => void
    'pm:remove'?:       (e: { layer: Layer }) => void
    'pm:markerdragend'?:(e: { layer: Layer }) => void
    'pm:cut'?:          (e: { layer: Layer; originalLayer: Layer }) => void
    'pm:rotateend'?:    (e: { layer: Layer }) => void
  }
}