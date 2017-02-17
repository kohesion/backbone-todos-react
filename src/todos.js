// An example Backbone application contributed by
// [Jérôme Gravel-Niquet](http://jgn.me/). This demo uses a simple
// [LocalStorage adapter](backbone.localStorage.html)
// to persist Backbone models within your browser.

import React, { Component } from 'react';
import ReactDOM from 'react-dom';

// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){

  // Todo Model
  // ----------

  // Our basic **Todo** model has `title`, `order`, and `done` attributes.
  var Todo = Backbone.Model.extend({

    // Default attributes for the todo item.
    defaults: function() {
      return {
        title: "empty todo...",
        order: Todos.nextOrder(),
        done: false
      };
    },

    // Toggle the `done` state of this todo item.
    toggle: function() {
      this.save({done: !this.get("done")});
    }

  });

  // Todo Collection
  // ---------------

  // The collection of todos is backed by *localStorage* instead of a remote
  // server.
  var TodoList = Backbone.Collection.extend({

    // Reference to this collection's model.
    model: Todo,

    // Save all of the todo items under the `"todos-backbone"` namespace.
    localStorage: new Backbone.LocalStorage("todos-backbone"),

    // Filter down the list of all todo items that are finished.
    done: function() {
      return this.where({done: true});
    },

    // Filter down the list to only todo items that are still not finished.
    remaining: function() {
      return this.where({done: false});
    },

    // We keep the Todos in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // Todos are sorted by their original insertion order.
    comparator: 'order'

  });

  // Create our global collection of **Todos**.
  var Todos = new TodoList;
  window.Todos = Todos;

  class TodoViewReact extends Component {
  	constructor (props) {
  		super(props);

  		this.model = props.model;
  		this.destroy = props.destroy;

  		this.state = {
		    ...this.model.toJSON(),
		    mode: 'normal'
	    }

	    this.handleToggle = this.handleToggle.bind(this);
  		this.handleDoubleClick = this.handleDoubleClick.bind(this);
  		this.handleKeyPress = this.handleKeyPress.bind(this);
  		this.handleTitleChange = this.handleTitleChange.bind(this);
  		this.handleDestroy = this.handleDestroy.bind(this);

    }

    shouldComponentUpdate (nextProps) {
  		return true;
    }

    componentWillReceiveProps (nextProps) {
	    this.setState(_.extend(this.state, nextProps.model.toJSON()));
    }

    handleToggle (evt) {
  		this.model.set({done: !this.state.done});
    }

    handleKeyPress(evt) {
  		this.setState({title: evt.target.value});
	    (evt.charCode === 13) && this.setState({mode: 'normal'});
    }

    handleTitleChange (evt) {
	    this.model.set({title: evt.target.value});
    }

    handleDoubleClick(evt) {
      this.setState({mode: 'edit'});
    }

    getClass () {
	    return [this.state.done ? 'done' : '',  (this.state.mode === 'edit') ? 'editing' : ''].join(' ');
    }

    handleDestroy () {
  		this.destroy(this.model);
    }

    render () {
  		return (
  		<li className={this.getClass()} key={this.state.key}>
		    <div className="view" onDoubleClick={this.handleDoubleClick}>
		        <input className="toggle" type="checkbox" checked={ this.state.done ? 'checked' : '' } onChange={this.handleToggle}  />
			    <label>{ this.state.title }</label>
	            <a className="destroy" onClick={this.handleDestroy}></a>
	        </div>
	        <input className="edit" type="text" value={ this.state.title } onKeyPress={this.handleKeyPress} onChange={this.handleTitleChange} />
	    </li>
	    );
    }

  }



  // Todo Item View
  // --------------

  // The DOM element for a todo item...
  var TodoView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "li",

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .toggle"   : "toggleDone",
      "dblclick .view"  : "edit",
      "click a.destroy" : "clear",
      "keypress .edit"  : "updateOnEnter",
      "blur .edit"      : "close"
    },

    // The TodoView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a **Todo** and a **TodoView** in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      this.listenTo(this.model, 'change', this.render);
      this.listenTo(this.model, 'destroy', this.remove);
    },

    // Re-render the titles of the todo item.
    render: function() {
      this.$el.html(this.template(this.model.toJSON()));
      this.$el.toggleClass('done', this.model.get('done'));
      this.input = this.$('.edit');
      return this;
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      this.$el.addClass("editing");
      this.input.focus();
    },

    // Close the `"editing"` mode, saving changes to the todo.
    close: function() {
      var value = this.input.val();
      if (!value) {
        this.clear();
      } else {
        this.model.save({title: value});
        this.$el.removeClass("editing");
      }
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.destroy();
    }

  });

  // The Application
  // ---------------

  // Our overall **AppView** is the top-level piece of UI.
  var AppView = Backbone.View.extend({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#todoapp"),

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "keypress #new-todo":  "createOnEnter",
      "click #clear-completed": "clearCompleted",
      "click #toggle-all": "toggleAllComplete"
    },

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved in *localStorage*.
    initialize: function() {

      this.input = this.$("#new-todo");
      this.allCheckbox = this.$("#toggle-all")[0];

      this.listenTo(Todos, 'add', this.addOne);
      this.listenTo(Todos, 'add', this.triggerReact);
      this.listenTo(Todos, 'reset', this.addAll);
      this.listenTo(Todos, 'all', this.render);
      this.listenTo(Todos, 'change', this.triggerReact);
      this.listenTo(Todos, 'remove', this.triggerReact);

      this.footer = this.$('footer');
      this.main = $('#main');

      Todos.fetch();
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = Todos.done().length;
      var remaining = Todos.remaining().length;

      if (Todos.length) {
        this.main.show();
        this.footer.show();
        this.footer.html(this.statsTemplate({done: done, remaining: remaining}));
      } else {
        this.main.hide();
        this.footer.hide();
      }
      this.allCheckbox.checked = !remaining;
    },

    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(todo) {
		var view = new TodoView({model: todo});
		this.$("#todo-list").append(view.render().el);
    },

    // Add all items in the **Todos** collection at once.
    addAll: function() {
      Todos.each(this.addOne, this);
    },

	  triggerReact: function() {

    	var destroy = (model) => {
    		model.destroy.call(model);
	    }

		  var todoCombiner = (Todos) => {
		  	console.log('Todos 2', Todos.toJSON());
			  return <ul className="todo-list">{Todos.map((todo) => { console.log('todo', todo); return (<TodoViewReact destroy={destroy} model={todo} key={todo.get('id')} />) })}</ul>;
		  };

		  ReactDOM.render(todoCombiner(Todos), document.querySelector('#todo-list-react'));

	  },

    // If you hit return in the main input field, create new **Todo** model,
    // persisting it to *localStorage*.
    createOnEnter: function(e) {
      if (e.keyCode != 13) return;
      if (!this.input.val()) return;

      Todos.create({title: this.input.val()});
      this.input.val('');
    },

    // Clear all done todo items, destroying their models.
    clearCompleted: function() {
      _.invoke(Todos.done(), 'destroy');
      return false;
    },

    toggleAllComplete: function () {
      var done = this.allCheckbox.checked;
      Todos.each(function (todo) { todo.save({'done': done}); });
    }

  });

  // Finally, we kick things off by creating the **App**.
  var App = new AppView;

});
