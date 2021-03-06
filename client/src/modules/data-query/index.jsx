import React from 'react'
import { useQuery } from '@apollo/client'
import { Loading, ErrorMsg } from '../shared-components'

export default ({
  query,
  variables,
  fetchPolicy = 'network-only',
  children,
  loadingComponent = null,
}) => {
  const { loading, error, data } = useQuery(query, { variables, fetchPolicy })

  if (loading) return loadingComponent ? loadingComponent : <Loading />

  if (error) return <ErrorMsg msg="ERROR fetching data" />

  return children(data)
}
