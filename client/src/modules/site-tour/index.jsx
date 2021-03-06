import React, { useState, useEffect } from 'react'
import { unmountComponentAtNode } from 'react-dom'
import { Button, DialogContainer } from 'react-md'
import tour from './tour/index.js'

/**
 * A tour is mounted into it's own component tree, separate from the main app
 * Starting the tour requires mounting this component tree (ReactDOM.render)
 * To exit the tour, the React component tree is unmounted
 */
const exit = () => unmountComponentAtNode(document.getElementById('app-tour'))

/**
 * This is a cheeky way of holding state between renders
 *
 * When tour progresses by clicking, the click handler will
 * set this variable. This variable is then read on the next
 * render. i.e. it allows for a dynamic tour based on clicking
 */
var destination

/**
 * The tour is rendered into a separate DOM tree to the app. It's possible that the
 * app hasn't finished rendering yet when the tour (semantically a different app in
 * the same web page) requests DOM elements. The tour configuration is only allowed
 * to specify DOM handles that exist, and always exist. Based on this... assume that
 * these DOM selectors must ALWAYS return elements (eventually). The "onPageReady"
 * function is a bit of a hack to ensure that the tour only references rendered DOM
 * elements
 */
const onPageReady = async ({ id = undefined, clickableElementsSelector = undefined }, cb) => {
  if (id) {
    while (!document.getElementById(id)) {
      await new Promise(res => setTimeout(res, 100))
    }
  }

  if (clickableElementsSelector) {
    while (!document.getElementsByClassName(clickableElementsSelector).length) {
      await new Promise(res => setTimeout(res, 100))
    }
  }

  cb()
}

/**
 * The history property is a closure over the main apps component
 * tree react-router-dom instance. This allows for controlling the
 * main app navigation from the tour, without re-rendering the tour
 * tree
 */
export default ({ history }) => {
  const [index, setIndex] = useState(0)
  const nextStep = tour[index + 1]
  const thisStep =
    tour[index].constructor === Array
      ? tour[index].find(step => step.destination === destination)
      : tour[index]

  useEffect(() => {
    if (!thisStep) return

    const { selector, pathname } = thisStep

    if (pathname !== window.location.pathname) {
      history.push(pathname)
    }

    if (selector) {
      const { id, options, clickableElementsSelector, goto } = selector
      let clickHandler

      onPageReady({ id, clickableElementsSelector }, () => {
        if (id) {
          const el = document.getElementById(id)
          const anchor = document.getElementById(`${id}-anchor`) || el
          el.classList.add('tour-active')
          anchor.scrollIntoView(options)
        }

        /**
         * This is not a particularly generic way of implementing click handlers
         * Basically the assumption is that it will always be a navigation button
         * that is clicked
         */
        if (clickableElementsSelector) {
          clickHandler = e => {
            const button = e.target.closest(`.${clickableElementsSelector}`)
            const classes = button.classList
            destination = [...classes]
              .filter(c => c.includes(clickableElementsSelector))
              .map(c => c.replace(clickableElementsSelector, ''))
              .filter(_ => _)[0]
              .replace('-', '')
            setIndex(goto ? tour.findIndex(({ id }) => id === goto) : index + 1)
          }

          // If a click handler is required, add to all elements
          clickableElementsSelector &&
            document.getElementsByClassName(clickableElementsSelector).forEach(el => {
              el.addEventListener('click', clickHandler)
            })
        }
      })

      return () => {
        // Release individually selected elements
        if (id) {
          document.getElementById(id).classList.remove('tour-active')
        }

        // Remove click listeners
        if (clickableElementsSelector) {
          clickableElementsSelector &&
            document.getElementsByClassName(clickableElementsSelector).forEach(el => {
              el.removeEventListener('click', clickHandler)
            })
        }
      }
    }
  }, [index])

  const {
    title = 'Tour',
    dialogStyle,
    dialogProps,
    text,
    selector,
    goto = undefined,
    end = undefined,
  } = thisStep

  return (
    <DialogContainer
      id="Site overview tour"
      {...dialogProps}
      dialogStyle={dialogStyle || {}}
      focusOnMount={false}
      visible={true}
      onHide={exit}
      modal
      title={title}
      actions={[
        <Button
          style={
            (nextStep || goto) && !end
              ? selector?.clickableElementsSelector
                ? { display: 'none' }
                : {}
              : { display: 'none' }
          }
          key="exit"
          flat
          primary
          onClick={exit}
        >
          Exit Tour
        </Button>,
        <Button
          key="next"
          flat
          primary
          onClick={
            (nextStep || goto) && !selector?.clickableElementsSelector && !end
              ? () => setIndex(goto ? tour.findIndex(({ id }) => id === goto) : index + 1)
              : exit
          }
        >
          {(nextStep || goto) && !end
            ? selector?.clickableElementsSelector
              ? 'Exit Tour'
              : 'Next'
            : 'End'}
        </Button>,
      ]}
    >
      {text}
    </DialogContainer>
  )
}
