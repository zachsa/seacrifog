import React from 'react'
import { Toolbar, Button, LinearProgress, Badge } from 'react-md'
import DataQuery from '../data-query'
import { useHistory } from 'react-router-dom'
import { ENTIRE_GRAPH } from '../../graphql/queries'
import { ExplorerSideMenuFilter } from './index'
import { SideMenu } from '../shared-components/index'
import MetadataList from './_metadata-list'
import { GlobalStateContext } from '../../global-state'

const getProgresStyle = loading => ({
  margin: 0,
  visibility: loading ? 'inherit' : 'hidden',
  position: 'absolute'
})

const mainMenuIconStyle = disabled => ({
  marginLeft: '10px',
  color: disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,1)'
})

const badgeStyle = disabled => ({
  color: disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,1)'
})

export default ({ resetFn, selectedIds, ...props }) => {
  const history = useHistory()
  const ctx = props.location.pathname.replace('/', '').toUpperCase()

  return (
    <GlobalStateContext.Consumer>
      {({ loadingSearchResults, searchResults, searchErrors }) => (
        <DataQuery
          loadingComponent={
            <>
              <LinearProgress id={'entity-save-progress-indicator'} style={getProgresStyle(loadingSearchResults)} />
              <Toolbar title={'Loading...'} colored className={'sf-content-header'} />
            </>
          }
          query={ENTIRE_GRAPH}
          variables={{}}
        >
          {({ sites, networks, variables, protocols }) => (
            <>
              <LinearProgress id={'entity-save-progress-indicator'} style={getProgresStyle(loadingSearchResults)} />
              <Toolbar
                colored
                title={ctx}
                className={'sf-content-header'}
                actions={[
                  <Badge
                    style={searchErrors.length > 0 ? {} : { display: 'none' }}
                    key={0}
                    badgeStyle={badgeStyle(searchErrors.length > 0 ? false : true)}
                    badgeContent={searchErrors.length}
                    badgeId={'search-results-errors'}
                  >
                    <Button
                      style={mainMenuIconStyle(searchErrors.length > 0 ? false : true)}
                      disabled={searchErrors.length > 0 ? false : true}
                      tooltipLabel={`${searchErrors.length} error${
                        searchErrors.length === 1 ? '' : 's'
                      } occured searching metadata`}
                      onClick={() => alert('Please alert SEACRIFOG administrators that search errors are occuring')}
                      icon
                    >
                      error
                    </Button>
                  </Badge>,

                  <SideMenu
                    toolbarTitle={'Metadata search results'}
                    key={51}
                    toolbarActions={[]}
                    control={({ toggleMenu }) => (
                      <Badge
                        key={1}
                        badgeStyle={badgeStyle(searchResults.length > 0 ? false : true)}
                        badgeContent={searchResults.length}
                        badgeId={'search-results-notification'}
                      >
                        <Button
                          tooltipLabel={`${searchResults.length} metadata record${
                            searchResults.length === 1 ? '' : 's'
                          } found`}
                          tooltipPosition="left"
                          className="md-btn--toolbar"
                          disabled={searchResults.length > 0 ? false : true}
                          style={Object.assign(
                            { marginTop: 0 },
                            mainMenuIconStyle(searchResults.length > 0 ? false : true)
                          )}
                          onClick={toggleMenu}
                          icon
                        >
                          storage
                        </Button>
                      </Badge>
                    )}
                  >
                    <MetadataList searchResults={searchResults} />
                  </SideMenu>,
                  <Button
                    key={2}
                    style={mainMenuIconStyle(selectedIds.length > 0 ? false : true)}
                    disabled={selectedIds.length > 0 ? false : true}
                    tooltipLabel={'View map'}
                    icon
                    onClick={() => history.push(`/sites`)}
                  >
                    map
                  </Button>,
                  <Button
                    key={3}
                    component={'a'}
                    tooltipLabel={'Download selected overviews'}
                    disabled={selectedIds.length > 0 ? false : true}
                    style={mainMenuIconStyle(selectedIds.length > 0 ? false : true)}
                    icon
                    download
                    href={encodeURI(
                      `${process.env.DOWNLOADS_ENDPOINT ||
                        'https://api.seacrifog.saeon.ac.za/downloads'}/${ctx}?filename=${ctx}-${new Date()}.json&ids=${selectedIds.join(
                        ','
                      )}`
                    )}
                  >
                    save_alt
                  </Button>,
                  <Button
                    key={4}
                    tooltipLabel={'Refresh current page filters'}
                    disabled={selectedIds.length > 0 ? false : true}
                    onClick={resetFn}
                    style={mainMenuIconStyle(selectedIds.length > 0 ? false : true)}
                    icon
                  >
                    refresh
                  </Button>,
                  <SideMenu
                    key={5}
                    toolbarActions={[]}
                    control={({ toggleMenu }) => (
                      <Button
                        tooltipLabel={'View current filters'}
                        tooltipPosition="left"
                        className="md-btn--toolbar"
                        style={mainMenuIconStyle()}
                        onClick={toggleMenu}
                        icon
                      >
                        filter_list
                      </Button>
                    )}
                  >
                    <ExplorerSideMenuFilter
                      sites={sites}
                      networks={networks}
                      variables={variables}
                      protocols={protocols}
                    />
                  </SideMenu>
                ]}
              />
            </>
          )}
        </DataQuery>
      )}
    </GlobalStateContext.Consumer>
  )
}
