import React, { PureComponent } from 'react'
import debounce from '../../lib/debounce'
import { mergeLeft } from 'ramda'
import { Toolbar, TextField, FontIcon, DataTable, TableHeader, TableRow, TableColumn, TableBody, TablePagination } from 'react-md'

export default class extends PureComponent {
  state = {}
  constructor(props) {
    super(props)
    this.rows = this.props.data.length
    this.state.slice = [0, 5]
    this.state.searchValue = ''
  }

  getFilteredData = searchValue => {
    const filteredData = this.props.data.filter(p => {
      const term = searchValue.toUpperCase().trim()
      if (term === '') return true
      else {
        // TODO: This is currently a bug in react-scripts 3.1.1
        // eslint-disable-next-line
        for (const key in p) {
          const value = p[key]
            .toString()
            .toUpperCase()
            .trim()
          if (value.indexOf(term) >= 0) return true
        }
      }
      return false
    })
    return filteredData
  }

  getDataSlice = data => {
    const { slice } = this.state
    return data.slice(slice[0], slice[1])
  }

  handlePagination = (start, rowsPerPage) => {
    this.setState({ slice: [start, start + rowsPerPage] })
  }

  render() {
    const { selectedRow, setHoveredRow, setSelectedRow, toolbarButtons, toolbarStyle, headers } = this.props
    const { searchValue } = this.state
    const rowsPerPageLabel = 'Rows'
    return (
      <>
        <Toolbar style={mergeLeft(toolbarStyle, { display: 'flex', alignItems: 'center' })} themed zDepth={0}>
          <TextField
            id="table-search"
            style={{ marginLeft: '20px', display: 'flex' }}
            block={true}
            autoComplete={'off'}
            value={searchValue}
            onChange={val => this.setState({ searchValue: val })}
            placeholder="Search by table fields..."
            leftIcon={<FontIcon>search</FontIcon>}
          />
          {toolbarButtons}
        </Toolbar>
        <DataTable baseId="paginated-table" plain>
          <TableHeader>
            <TableRow>
              {headers.map(header => (
                <TableColumn role="button" key={`header-col-${header}`} style={{ textAlign: 'center' }}>
                  {header}
                </TableColumn>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody onMouseLeave={() => setHoveredRow(null)}>
            {this.getDataSlice(this.getFilteredData(searchValue)).map((row, i) => (
              <TableRow
                className={row.id === (selectedRow || {}).id ? 'selected-row' : ''}
                key={`table-row-${i}`}
                onMouseOver={debounce(() => setHoveredRow(row), 5)}
                onClick={() => {
                  if (!setSelectedRow) return
                  else if ((selectedRow || {}).id !== row.id) setSelectedRow(row)
                  else setSelectedRow(null)
                }}
              >
                {Object.keys(row)
                  .filter(col => col !== '__typename' && col !== 'id')
                  .map((col, j) => (
                    <TableColumn key={`table-col-${i}-${j}`} style={{ cursor: 'pointer' }}>
                      {row[col].constructor === String ? row[col].toString().truncate(100, '..') : row[col]}
                    </TableColumn>
                  ))}
              </TableRow>
            ))}
          </TableBody>
          <TablePagination
            defaultRowsPerPage={5}
            rowsPerPageItems={[5, 10, 25, 50]}
            rows={this.getFilteredData(searchValue).length}
            rowsPerPageLabel={rowsPerPageLabel}
            onPagination={this.handlePagination}
          />
        </DataTable>
      </>
    )
  }
}
