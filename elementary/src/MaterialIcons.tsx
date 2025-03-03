/**
 * This file is intended for declaring type definitions that help
 * work with Google's Material Design libraries
 */
import React from 'react'
import { jcss } from './jcss'

/**
 * A non-exhaustive list of valid icon ligatures from
 * https://google.github.io/material-design-icons/ font
 */
export type MaterialIconType =
  | 'account_circle'
  | 'add'
  | 'archive'
  | 'bookmark_add'
  | 'cancel'
  | 'close'
  | 'cloud_sync'
  | 'cloud_upload'
  | 'code'
  | 'content_copy'
  | 'content_cut'
  | 'delete'
  | 'download'
  | 'expand_less'
  | 'expand_more'
  | 'file_upload'
  | 'fit_screen'
  | 'format_bold'
  | 'format_italic'
  | 'format_list_bulleted'
  | 'format_list_numbered'
  | 'format_quote'
  | 'format_underlined'
  | 'fullscreen'
  | 'insert_link'
  | 'launch'
  | 'link_off'
  | 'looks_one'
  | 'looks_two'
  | 'more_horiz'
  | 'open_in_full'
  | 'public'
  | 'save'
  | 'search'
  | 'sync'
  | 'travel_explore'
  | 'youtube_searched_for'
  | 'zoom_in'
  | 'zoom_out'

type MaterialIconAttrs = React.HTMLProps<HTMLSpanElement>

type NamedMaterialIconAttrs = {
  type: MaterialIconType
} & MaterialIconAttrs

export const MaterialIcon = React.forwardRef<
  HTMLSpanElement,
  NamedMaterialIconAttrs
>(({ type, className, key }, ref) => (
  <span className={jcss('material-icons', className)} key={key} ref={ref}>
    {type}
  </span>
))

const _makeMaterialIcon = (type: MaterialIconType) => {
  return React.forwardRef<HTMLSpanElement, MaterialIconAttrs>(
    ({ className, key }: MaterialIconAttrs, ref) => (
      <MaterialIcon type={type} className={className} key={key} ref={ref} />
    )
  )
}

export const MdiAccountCircle = _makeMaterialIcon('account_circle')
export const MdiAdd = _makeMaterialIcon('add')
export const MdiArchive = _makeMaterialIcon('archive')
export const MdiBookmarkAdd = _makeMaterialIcon('bookmark_add')
export const MdiCancel = _makeMaterialIcon('cancel')
export const MdiClose = _makeMaterialIcon('close')
export const MdiCloudSync = _makeMaterialIcon('cloud_sync')
export const MdiCloudUpload = _makeMaterialIcon('cloud_upload')
export const MdiCode = _makeMaterialIcon('code')
export const MdiContentCopy = _makeMaterialIcon('content_copy')
export const MdiContentCut = _makeMaterialIcon('content_cut')
export const MdiDelete = _makeMaterialIcon('delete')
export const MdiDownload = _makeMaterialIcon('download')
export const MdiExpandLess = _makeMaterialIcon('expand_less')
export const MdiExpandMore = _makeMaterialIcon('expand_more')
export const MdiFileUpload = _makeMaterialIcon('file_upload')
export const MdiFitScreen = _makeMaterialIcon('fit_screen')
export const MdiFormatBold = _makeMaterialIcon('format_bold')
export const MdiFormatItalic = _makeMaterialIcon('format_italic')
export const MdiFormatListBulleted = _makeMaterialIcon('format_list_bulleted')
export const MdiFormatListNumbered = _makeMaterialIcon('format_list_numbered')
export const MdiFormatQuote = _makeMaterialIcon('format_quote')
export const MdiFormatUnderlined = _makeMaterialIcon('format_underlined')
export const MdiFullscreen = _makeMaterialIcon('fullscreen')
export const MdiInsertLink = _makeMaterialIcon('insert_link')
export const MdiLaunch = _makeMaterialIcon('launch')
export const MdiLinkOff = _makeMaterialIcon('link_off')
export const MdiLooksOne = _makeMaterialIcon('looks_one')
export const MdiLooksTwo = _makeMaterialIcon('looks_two')
export const MdiMoreHoriz = _makeMaterialIcon('more_horiz')
export const MdiOpenInFull = _makeMaterialIcon('open_in_full')
export const MdiPublic = _makeMaterialIcon('public')
export const MdiSave = _makeMaterialIcon('save')
export const MdiSearch = _makeMaterialIcon('search')
export const MdiSync = _makeMaterialIcon('sync')
export const MdiTravelExplore = _makeMaterialIcon('travel_explore')
export const MdiYoutubeSearchedFor = _makeMaterialIcon('youtube_searched_for')
export const MdiZoomIn = _makeMaterialIcon('zoom_in')
export const MdiZoomOut = _makeMaterialIcon('zoom_out')
