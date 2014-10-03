# stickyRows jQuery plugin

## About

jquery.stickyRows is a floating/sticky table rows plugin that supports window and overflow scrolling of multiple rows.


## Features

- The first main difference from other plugins - you can stack any number of rows at the same time
- Second difference - plugin can handle resize not only window, but any container that you want and redraw without your attention
- Horizontal and vertical scrolling of window or any container or both
- Doesn't conflict with your styles
- Doesn't matter, has row colspan or not

## Usage
```html
<table class="table-with-sticky-rows">
  <thead>
    <tr>
        <td>Header1</td>
        <td>Header2</td>
    </tr>
  </thead>
  <tbody>
    <tr>
        <td>Cell1</td>
        <td>Cell2</td>
    </tr>
    <tr>
        <td>Cell1</td>
        <td>Cell2</td>
    </tr>
  </tbody>
</table>
```

```javascript
$(function(){
  $('.table-with-sticky-rows').stickyRows();
});
```

## Demo
http://maslianok.github.io/stickyRows/
