Ext.ns('SM')

SM.NodeSorter = (a, b) => {
  if (a.sortToTop) {
    return -1
  }
  if (b.sortToTop) {
    return 1
  }
  return a.text < b.text ? -1 : 1
}

SM.CollectionNodeConfig = function (collection) {
  const onAssetChanged = async (node, apiAsset) => {
    let apiAssetBids = apiAsset.stigs.map( stig => stig.benchmarkId )
    // changing this asset might have changed the Collection STIG list
    let result = await Ext.Ajax.requestPromise({
      url: `${STIGMAN.Env.apiBase}/collections/${apiAsset.collection.collectionId}`,
      method: 'GET',
      params: {
        projection: 'stigs'
      }
    })
    let collectionStigs = JSON.parse(result.response.responseText).stigs
    let collectionBids = collectionStigs.map( stig => stig.benchmarkId )
    let nodeBids = []
    let stigNodesToRemove = []
    // Iterate existing STIG nodes
    for ( let stigNode of node.childNodes) {
      if ( collectionBids.includes( stigNode.attributes.benchmarkId ) ) {
        // The collection includes this STIG
        nodeBids.push(stigNode.attributes.benchmarkId)
        if ( stigNode.isExpanded() ) {
          // The node is expanded and showing Assets
          // Try to get the node for this Asset, if it exists
          let stigAssetNode = stigNode.findChild('assetId', apiAsset.assetId)

          // Does this Asset include this STIG
          stigIsMappedToAsset = apiAssetBids.includes(stigNode.attributes.benchmarkId)
          if (stigIsMappedToAsset) {
            // The STIG is mapped to this Asset
            if (stigAssetNode) {
              // The Asset node exists
              if (stigAssetNode.attributes.text !== apiAsset.name) {
                // Update the node text if necessary
                stigAssetNode.setText(apiAsset.name)
                stigNode.sort(SM.NodeSorter)
              }
            }
            else {
              // The Asset node does not exist -- create it
              stigNode.appendChild(SM.StigAssetNodeConfig(stigNode.attributes, apiAsset))
              stigNode.sort(SM.NodeSorter)
            }
          }
          else {
            // The STIG is NOT mapped to this Asset
            if (stigAssetNode) {
              // The Asset node exists -- remove it
              stigAssetNode.remove(true)
            }
          }
        }
      }
      else {
        // The collection no longer includes this STIG
        stigNodesToRemove.push(stigNode)
      }           
    }
    for (let stigNodeToRemove of stigNodesToRemove) {
      stigNodeToRemove.remove(true)
    }
    // Add new STIG node(s), if any
    for (let collectionStig of collectionStigs) {
      if (!nodeBids.includes(collectionStig.benchmarkId)) {
        node.appendChild(SM.StigNodeConfig(apiAsset.collection.collectionId, collectionStig))
        node.sort(SM.NodeSorter)
      }
    }
  }
  const onAssetDeleted = async (node, apiAsset) => {
    // deleting this asset might have changed the Collection STIG list
    let result = await Ext.Ajax.requestPromise({
      url: `${STIGMAN.Env.apiBase}/collections/${apiAsset.collection.collectionId}`,
      method: 'GET',
      params: {
        projection: 'stigs'
      }
    })
    let collectionStigs = JSON.parse(result.response.responseText).stigs
    let collectionBids = collectionStigs.map( stig => stig.benchmarkId )
    let nodeBids = []
    let stigNodesToRemove = []
    // Iterate existing STIG nodes
    for ( let stigNode of node.childNodes) {
      if ( collectionBids.includes( stigNode.attributes.benchmarkId ) ) {
        // The collection includes this STIG
        nodeBids.push(stigNode.attributes.benchmarkId)
        if ( stigNode.isExpanded() ) {
          // The node is expanded and showing Assets
          // Try to get the node for this Asset, if it exists
          let stigAssetNode = stigNode.findChild('assetId', apiAsset.assetId)
          if (stigAssetNode) {
            // The Asset node exists -- remove it
            stigAssetNode.remove(true)
          }
        }
      }
      else {
        // The collection no longer includes this STIG
        stigNodesToRemove.push(stigNode)
      }           
    }
    for (let stigNodeToRemove of stigNodesToRemove) {
      stigNodeToRemove.remove(true)
    }
  }

  let children = []
  collectionGrant = curUser.collectionGrants.find( g => g.collection.collectionId === collection.collectionId )
  if (collectionGrant && collectionGrant.accessLevel >= 3) {
    children.push({
      id: `${collection.collectionId}-pkgconfig-node`,
      text: 'Configuration',
      collectionId: collection.collectionId,
      collectionName: collection.name,
      action: 'collection-management',
      iconCls: 'sm-setting-icon',
      leaf: true
    })
  }
  children.push(
    {
      id: `${collection.collectionId}-findings-node`,
      text: 'Findings',
      collectionId: collection.collectionId,
      collectionName: collection.name,
      iconCls: 'sm-report-icon',
      action: 'findings',
      leaf: true
    },
    {
      id: `${collection.collectionId}-assets-node`,
      node: 'assets',
      text: 'Assets',
      iconCls: 'sm-asset-icon'
    },
    {
      id: `${collection.collectionId}-stigs-node`,
      node: 'stigs',
      text: 'STIGs',
      iconCls: 'sm-stig-icon',
      onAssetChanged: onAssetChanged,
      onAssetDeleted: onAssetDeleted
    }
  )
  let node = {
    id: `${collection.collectionId}-collection-node`,
    node: 'collection',
    text: collection.name,
    collectionId: collection.collectionId,
    collectionName: collection.name,
    iconCls: 'sm-collection-icon',
    children: children
  }
  return node
}

SM.AssetNodeConfig = function (collectionId, asset) {
  const onAssetChanged = (node, apiAsset) => {
    let apiAssetBenchmarkIds = apiAsset.stigs.map( stig => stig.benchmarkId )
    if (node.attributes.text !== apiAsset.name) {
      node.setText(apiAsset.name)
      node.parentNode.sort(SM.NodeSorter)  
    }
    if (node.isExpanded()) {
      // Node has STIG childen
      let benchmarkIdsToKeep = []
      // Remove STIGs no longer mapped to this Asset
      const nodesToRemove = []
      for (let stigNode of node.childNodes) {
        if (!apiAssetBenchmarkIds.includes(stigNode.attributes.benchmarkId)) {
          nodesToRemove.push(stigNode)
        }
        else {
          benchmarkIdsToKeep.push(stigNode.attributes.benchmarkId)
        }
      }
      for (let nodeToRemove of nodesToRemove) {
        nodeToRemove.remove(true)
      }
      // Add new STIG(s), if any
      for (let apiAssetStig of apiAsset.stigs) {
        if (!benchmarkIdsToKeep.includes(apiAssetStig.benchmarkId)) {
          node.appendChild( SM.AssetStigNodeConfig(apiAsset, apiAssetStig) )
          node.sort(SM.NodeSorter)
        }
      }
    }
  }
  return {
    id: `${collectionId}-${asset.assetId}-assets-asset-node`,
    text: asset.name,
    report: 'asset',
    collectionId: collectionId,
    assetId: asset.assetId,
    iconCls: 'sm-asset-icon',
    qtip: asset.name,
    onAssetChanged: onAssetChanged
  }
}

SM.AssetStigNodeConfig = function (asset, stig) {
  return {
    id: `${asset.collection.collectionId}-${asset.assetId}-${stig.benchmarkId}-leaf`,
    text: stig.benchmarkId,
    leaf: true,
    report: 'review',
    iconCls: 'sm-stig-icon',
    stigName: stig.benchmarkId,
    assetName: asset.name,
    // stigRevStr: stig.lastRevisionStr,
    assetId: asset.assetId,
    collectionId: asset.collection.collectionId,
    workflow: asset.collection.workflow,
    benchmarkId: stig.benchmarkId,
    qtip: stig.title
  }
}

SM.StigNodeConfig = function (collectionId, stig) {
  return {
    collectionId: collectionId,
    text: stig.benchmarkId,
    report: 'stig',
    iconCls: 'sm-stig-icon',
    // stigRevStr: stig.lastRevisionStr,
    id: `${collectionId}-${stig.benchmarkId}-stigs-stig-node`,
    benchmarkId: stig.benchmarkId,
    qtip: stig.title
  }
}

SM.StigAssetNodeConfig = function (stig, asset) {
  return {
    id: `${asset.collection.collectionId}-${asset.assetId}-${stig.benchmarkId}-leaf`,
    text: asset.name,
    leaf: true,
    report: 'review',
    iconCls: 'sm-asset-icon',
    stigName: stig.benchmarkId,
    assetName: asset.name,
    // stigRevStr: stig.lastRevisionStr,
    assetId: asset.assetId,
    collectionId: asset.collection.collectionId,
    benchmarkId: stig.benchmarkId,
    qtip: asset.name
  }
}

SM.StigBatchNodeConfig = function (benchmarkId, collectionId) {
  return {
    id: `${collectionId}-batch-${benchmarkId}-leaf`,
    sortToTop: true,
    text: 'Collection review',
    cls: 'sm-tree-node-collection-review',
    leaf: true,
    report: 'collection-review',
    iconCls: 'sm-collection-icon',
    collectionId: collectionId,
    benchmarkId: benchmarkId,
    qtip: 'Review multiple assets'
  }
}


SM.AppNavTree = Ext.extend(Ext.tree.TreePanel, {
    initComponent: function() {
      let me = this
      let config = {
          autoScroll: true,
          split: true,
          collapsible: true,
          title: '<span onclick="window.keycloak.logout()">' + curUser.display + ' - Logout</span>',
          bodyStyle: 'padding:5px;',
          width: me.width || 300,
          minSize: 220,
          root: {
            nodeType: 'async',
            id: 'stigman-root',
            expanded: true
          },
          rootVisible: false,
          loader: new Ext.tree.TreeLoader({
            directFn: me.loadTree
          }),
          loadMask: 'Loading...',
          listeners: {
            click: me.treeClick,
            beforeexpandnode: function (n) {
              n.loaded = false; // always reload from the server
            }
          }
      }
      this.onCollectionCreated = function (apiCollection) {
          let collectionRoot = me.getNodeById('collections-root')
          collectionRoot.appendChild( SM.CollectionNodeConfig( apiCollection ) )
          function sortFn (a, b) {
            if (a.attributes.id === 'collection-create-leaf') {
              return -1
            }
            if (b.attributes.id === 'collection-create-leaf') {
              return 1
            }
            if (a.text < b.text) {
              return -1
            }
            if (a.text > b.text) {
              return 1
            }
            return 0
          }
          collectionRoot.sort(sortFn)
      }
      this.sortNodes = (a, b) => a.text < b.text ? -1 : 1
      this.onAssetChanged = (apiAsset) => {
        let assetsNode = me.getNodeById(`${apiAsset.collection.collectionId}-assets-node`)
        if (assetsNode && assetsNode.isExpanded() ) {
          let assetNode = assetsNode.findChild('assetId', apiAsset.assetId)
          if (assetNode) {
            assetNode.attributes.onAssetChanged(assetNode, apiAsset)
          }
        }
        let stigsNode = me.getNodeById(`${apiAsset.collection.collectionId}-stigs-node`)
        if (stigsNode && stigsNode.isExpanded()) {
          stigsNode.attributes.onAssetChanged(stigsNode, apiAsset)
        }
      }
      this.onAssetCreated = (apiAsset) => {
        let assetsNode = me.getNodeById(`${apiAsset.collection.collectionId}-assets-node`, true)
        if ( assetsNode && assetsNode.isExpanded() ) {
          assetsNode.appendChild(SM.AssetNodeConfig(apiAsset.collection.collectionId, apiAsset))
        }
        let stigsNode = me.getNodeById(`${apiAsset.collection.collectionId}-stigs-node`)
        if (stigsNode && stigsNode.isExpanded()) {
          stigsNode.attributes.onAssetChanged(stigsNode, apiAsset)
        }
      }
      this.onAssetDeleted = (apiAsset) => {
        let assetsNode = me.getNodeById(`${apiAsset.collection.collectionId}-assets-node`, true)
        if (assetsNode && assetsNode.isExpanded() ) {
          let assetNode = assetsNode.findChild('assetId', apiAsset.assetId)
          if (assetNode) {
            assetNode.remove(true)
          }
        }
        let stigsNode = me.getNodeById(`${apiAsset.collection.collectionId}-stigs-node`)
        if (stigsNode && stigsNode.isExpanded()) {
          stigsNode.attributes.onAssetDeleted(stigsNode, apiAsset)
        }
      }
      this.onCollectionChanged = function (changes) {
        if ('name' in changes) {
          let collectionRoot = me.getNodeById('collections-root')
          let collectionNode = collectionRoot.findChild('id', `${changes.collectionId}-collection-node`, true)
          if (collectionNode) {
            collectionNode.setText(changes.name)
            collectionNode.collectionName = changes.name
            collectionNode.eachChild( child => {
              if (child.attributes.collectionName) {
                child.attributes.collectionName = changes.name
              }
            })
          }
        }
      }
      this.onStigAssetsChanged = async (collectionId, benchmarkId, apiStigAssets) => {
        let apiAssetIds = apiStigAssets.map( a => a.assetId )
        let stig = await me.getApiStig(benchmarkId)

        // Handle Assets node
        let assetsNode = me.getNodeById(`${collectionId}-assets-node`)
        if (assetsNode && assetsNode.isExpanded() ) {
          // "Assets" node is expanded -- iterate children
          for (const assetNode of assetsNode.childNodes) {
            if ( assetNode.isExpanded() ) {
              // Find any child node for this STIG
              let stigNode = assetNode.findChild( 'benchmarkId', benchmarkId)
              if (apiAssetIds.includes(assetNode.attributes.assetId)) {
                // STIG is attached to this Asset
                if (!stigNode) {
                  // No child node for this STIG -- create one
                  assetNode.appendChild( SM.AssetStigNodeConfig( {
                    collection: {
                      collectionId: assetNode.attributes.collectionId
                    },
                    assetId: assetNode.attributes.assetId,
                    name: assetNode.attributes.text
                  },
                  stig ) )
                  assetNode.sort(SM.NodeSorter)
                }
              }
              else {
                // STIG is NOT attached to this Asset
                if (stigNode) {
                  // There is a child node for this STIG -- remove it
                  stigNode.remove(true)
                }
              }
            }
          }
        }

        // Handle STIG node
        let stigsNode = me.getNodeById(`${collectionId}-stigs-node`)
        if (stigsNode && stigsNode.isExpanded()) {
          let stigNode = me.getNodeById(`${collectionId}-${benchmarkId}-stigs-stig-node`)
          if (!stigNode) {
            // No child for this STIG -- create one
            stigsNode.appendChild( SM.StigNodeConfig( collectionId, stig ) )
            stigsNode.sort( SM.NodeSorter )
            return
          }
          if (apiAssetIds.length === 0) {
            // STIG has been unattached from all Assets
            if (stigNode) {
              stigNode.remove(true)
              return
            }
            else {
              // Should not be here -- new STIG with no Assets!?
              return
            }
          }
          if (stigNode && stigNode.isExpanded()) {
            const nodesToRemove = []
            const assetIdsToKeep = []
            for (const assetNode of stigNode.childNodes) {
              if (!apiAssetIds.includes( assetNode.attributes.assetId)) {
                // STIG is no longer attached to this asset
                nodesToRemove.push(assetNode)
              }
              else {
                assetIdsToKeep.push(assetNode.attributes.assetId)
              }
            }
            for (let nodeToRemove of nodesToRemove) {
              nodeToRemove.remove(true)
            }
            // Add new Asset(s), if any
            for (let apiStigAsset of apiStigAssets) {
              if (!assetIdsToKeep.includes(apiStigAsset.assetId)) {
                apiStigAsset.collection = {
                  collectionId: collectionId
                }
                stigNode.appendChild( SM.StigAssetNodeConfig(stig, apiStigAsset) )
              }
            }
            stigNode.sort(SM.NodeSorter)
          }
        }

      }
      this.getApiStig = async (benchmarkId) => {
        try {
          let result = await Ext.Ajax.requestPromise({
            url: `${STIGMAN.Env.apiBase}/stigs/${benchmarkId}`,
            method: 'GET'
          })
          return JSON.parse(result.response.responseText)
        }
        catch (e) {
          alert (e.message)
        }
      }

      Ext.apply(this, Ext.apply(this.initialConfig, config))
      SM.AppNavTree.superclass.initComponent.call(this)

      // Attach handlers for app events
      SM.Dispatcher.addListener('collectioncreated', this.onCollectionCreated)
      SM.Dispatcher.addListener('collectionchanged', this.onCollectionChanged)
      SM.Dispatcher.addListener('assetchanged', this.onAssetChanged, me)
      SM.Dispatcher.addListener('assetcreated', this.onAssetCreated, me)
      SM.Dispatcher.addListener('assetdeleted', this.onAssetDeleted, me)
      SM.Dispatcher.addListener('stigassetschanged', this.onStigAssetsChanged, me) 
    },
    loadTree: async function (node, cb) {
        try {
          let match, collectionGrant
          // Root node
          if (node == 'stigman-root') {
            let content = []
            if (curUser.privileges.canAdmin) {
              content.push(
                {
                  id: `admin-root`,
                  node: 'admin',
                  text: 'Administration',
                  iconCls: 'sm-setting-icon',
                  expanded: true,
                  children: [
                    {
                      id: 'user-admin',
                      text: 'Users',
                      leaf: true,
                      iconCls: 'sm-users-icon'
                    },
                    {
                      id: 'stig-admin',
                      text: 'STIG and SCAP Benchmarks',
                      leaf: true,
                      iconCls: 'sm-stig-icon'
                    },
                    {
                      id: 'appdata-admin',
                      text: 'Application Data ',
                      leaf: true,
                      iconCls: 'sm-database-save-icon'
                    }
                  ]
                }
              )
            }
            content.push(
              {
                id: `collections-root`,
                node: 'collections',
                text: 'Collections',
                iconCls: 'sm-collection-icon',
                expanded: true
              }
            )
            cb(content, { status: true })
            return
          }
          if (node === 'collections-root') {
            let result = await Ext.Ajax.requestPromise({
              url: `${STIGMAN.Env.apiBase}/collections`,
              method: 'GET'
            })
            let apiCollections = JSON.parse(result.response.responseText)
            let content = apiCollections.map(collection => SM.CollectionNodeConfig(collection))
            if (curUser.privileges.canCreateCollection) {
              content.unshift({
                id: `collection-create-leaf`,
                action: 'collection-create',
                text: 'Create Collection...',
                cls: 'sm-tree-node-create',
                iconCls: 'sm-add-icon',
                qtip: 'Create a new STIG Manager Collection',
                leaf: true
              })
            }
            cb(content, { status: true })
            return
          }
          // Collection-Assets node
          match = node.match(/(\d+)-assets-node/)
          if (match) {
            let collectionId = match[1]
            let result = await Ext.Ajax.requestPromise({
              url: `${STIGMAN.Env.apiBase}/collections/${collectionId}`,
              method: 'GET',
              params: {
                projection: 'assets'
              }
            })
            let apiCollection = JSON.parse(result.response.responseText)
            let content = apiCollection.assets.map(asset => SM.AssetNodeConfig(collectionId, asset))
            cb(content, { status: true })
            return
          }
          // Collection-Assets-STIG node
          match = node.match(/(\d+)-(\d+)-assets-asset-node/)
          if (match) {
            let collectionId = match[1]
            let assetId = match[2]
            let result = await Ext.Ajax.requestPromise({
              url: `${STIGMAN.Env.apiBase}/assets/${assetId}`,
              method: 'GET',
              params: {
                projection: 'stigs'
              }
            })
            let apiAsset = JSON.parse(result.response.responseText)
            let content = apiAsset.stigs.map(stig => SM.AssetStigNodeConfig(apiAsset, stig))
            cb(content, { status: true })
            return
          }
      
          // Collection-STIGs node
          match = node.match(/(\d+)-stigs-node/)
          if (match) {
            let collectionId = match[1]
            let result = await Ext.Ajax.requestPromise({
              url: `${STIGMAN.Env.apiBase}/collections/${collectionId}`,
              method: 'GET',
              params: {
                projection: 'stigs'
              }
            })
            let apiCollection = JSON.parse(result.response.responseText)
            let content = apiCollection.stigs.map( stig => SM.StigNodeConfig( collectionId, stig ) )
            cb( content, { status: true } )
            return
          }
          // Collection-STIGs-Asset node
          match = node.match(/(\d+)-(.*)-stigs-stig-node/)
          if (match) {
            let collectionId = match[1]
            let benchmarkId = match[2]
              // TODO: Should use endpoint /collections/{collectionId}/stigs/{benchmarkId}/assets
              let result = await Ext.Ajax.requestPromise({
              url: `${STIGMAN.Env.apiBase}/collections/${collectionId}/stigs/${benchmarkId}/assets`,
              method: 'GET'
            })
            let apiAssets = JSON.parse(result.response.responseText)
            let content = []
            if (apiAssets.length > 0) {
            // Allow for batch review node
            collectionGrant = curUser.collectionGrants.find( g => g.collection.collectionId === collectionId )
              if (curUser.privileges.globalAccess || (collectionGrant && collectionGrant.accessLevel >= 2)) {
                content.push( SM.StigBatchNodeConfig( benchmarkId, collectionId ) )
              }
              let stigAssetNodes = apiAssets.map(asset => SM.StigAssetNodeConfig({benchmarkId: benchmarkId}, asset))
              content = content.concat(stigAssetNodes)
            }      
            cb(content, { status: true })
            return
          }
      
      
        }
        catch (e) {
          Ext.Msg.alert('Status', 'AJAX request failed in loadTree()');
        }
    },
    treeClick: function (n) {
        var idAppend;
        var tab;
      
        if (n.attributes.report == 'review') {
          idAppend = '-' + n.attributes.assetId + '-' + n.attributes.benchmarkId.replace(".", "_");
          tab = Ext.getCmp('main-tab-panel').getItem('reviewTab' + idAppend);
          if (tab) {
            tab.show();
          } else {
            addReview(n.attributes);
          }
        }
        if (n.attributes.action == 'import') {
          uploadArchive(n);
        }
        if (n.attributes.action == 'findings') {
          addFindingsSummary(n.attributes.collectionId, n.attributes.collectionName);
        }
        if (n.attributes.action == 'collection-create') {
          let collectionRootNode = n.parentNode
          let fp = new SM.CollectionForm({
            btnText: 'Create',
            btnHandler: () => {
              let values = fp.getForm().getFieldValues()
              createCollection(values, curUser.userId)
            }
          })
          fp.getForm().setValues({
            grants: [{
              user: {
                userId: curUser.userId,
                username: curUser.username
              },
              accessLevel: 4
            }],
          })
          let appwindow = new Ext.Window({
            id: 'window-project-info',
            title: 'Create STIG Manager Project',
            modal: true,
            width: 560,
            height:550,
            layout: 'fit',
            plain: false,
            bodyStyle:'padding:5px;',
            buttonAlign:'right',
            items: fp
          })
          appwindow.show(document.body)
        }
      
        if (n.attributes.action == 'collection-management') {
            addCollectionManager(n.attributes.collectionId, n.attributes.collectionName)
        }
      
        switch (n.id) {
          case 'user-admin':
            addUserAdmin();
            break;
          case 'stig-admin':
            addStigAdmin();
            break;
          case 'appdata-admin':
            addAppDataAdmin();
            break;
        }
      
    }
})
